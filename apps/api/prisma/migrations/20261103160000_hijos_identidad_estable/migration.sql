-- Identidad estable de hijos/as (plan abstract-gathering-bachman, etapa 1). Cada hijo/a existe una
-- sola vez en "HijoUsuaria", ligado a su madre; "Nino" queda como su participación en un caso
-- (conserva id, número y todas las llaves que apuntan a él). No borra datos: las columnas
-- personales de "Nino" solo dejan de ser obligatorias y se eliminan en una migración aparte.

-- CreateTable
CREATE TABLE "HijoUsuaria" (
    "id" TEXT NOT NULL,
    "usuariaId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fechaNacimiento" DATE NOT NULL,
    "genero" "GeneroPersona" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HijoUsuaria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HijoUsuaria_usuariaId_idx" ON "HijoUsuaria"("usuariaId");

ALTER TABLE "HijoUsuaria" ADD CONSTRAINT "HijoUsuaria_usuariaId_fkey" FOREIGN KEY ("usuariaId") REFERENCES "Usuaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Nino" ADD COLUMN "hijoId" TEXT;

-- ---- Relleno ----
-- Se unen solo coincidencias exactas dentro de la misma madre: nombres y apellidos iguales
-- (sin distinguir mayúsculas ni espacios de los extremos), misma fecha de nacimiento y mismo
-- género. Cualquier diferencia los deja como personas distintas: unir por error mezclaría el
-- historial de dos niños, separarlos por error solo duplica una ficha.
CREATE TEMP TABLE "_grupo_hijo" ON COMMIT DROP AS
SELECT
  n.id AS "ninoId",
  e."usuariaId",
  first_value(n.id) OVER grupo AS "representante",
  row_number() OVER grupo AS fila
FROM "Nino" n
JOIN "Expediente" e ON e.id = n."expedienteId"
WINDOW grupo AS (
  PARTITION BY e."usuariaId", lower(btrim(n."nombres")), lower(btrim(n."apellidos")),
               n."fechaNacimiento", n."genero"
  -- Los datos de la ficha salen del caso más reciente (la última vez que TS los anotó).
  ORDER BY e."fecha" DESC, e."createdAt" DESC, n.id
);

INSERT INTO "HijoUsuaria" ("id", "usuariaId", "nombres", "apellidos", "fechaNacimiento", "genero", "createdAt", "updatedAt")
SELECT g."representante", g."usuariaId", btrim(n."nombres"), btrim(n."apellidos"), n."fechaNacimiento", n."genero",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_grupo_hijo" g
JOIN "Nino" n ON n.id = g."ninoId"
WHERE g.fila = 1;

UPDATE "Nino" n SET "hijoId" = g."representante"
FROM "_grupo_hijo" g
WHERE g."ninoId" = n.id;

DO $$
DECLARE
  sin_hijo integer;
  unidos integer;
BEGIN
  SELECT count(*) INTO sin_hijo FROM "Nino" WHERE "hijoId" IS NULL;
  IF sin_hijo > 0 THEN
    RAISE EXCEPTION 'Relleno incompleto: % filas de Nino sin hijoId', sin_hijo;
  END IF;
  SELECT (SELECT count(*) FROM "Nino") - (SELECT count(*) FROM "HijoUsuaria") INTO unidos;
  RAISE NOTICE 'Hijos/as: % registros de casos unidos a una ficha ya existente', unidos;
  -- El mismo hijo/a dos veces en un caso no debería existir; si existe se revisa a mano.
  IF EXISTS (SELECT 1 FROM "Nino" GROUP BY "hijoId", "expedienteId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay un hijo/a repetido dentro de un mismo expediente; revisar antes de migrar';
  END IF;
END $$;

ALTER TABLE "Nino" ALTER COLUMN "hijoId" SET NOT NULL,
ALTER COLUMN "nombres" DROP NOT NULL,
ALTER COLUMN "apellidos" DROP NOT NULL,
ALTER COLUMN "fechaNacimiento" DROP NOT NULL,
ALTER COLUMN "genero" DROP NOT NULL;

CREATE UNIQUE INDEX "Nino_hijoId_expedienteId_key" ON "Nino"("hijoId", "expedienteId");

ALTER TABLE "Nino" ADD CONSTRAINT "Nino_hijoId_fkey" FOREIGN KEY ("hijoId") REFERENCES "HijoUsuaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---- Solo hijos/as de la usuaria del caso ----
-- La aplicación lo valida; la base lo garantiza aunque un error de código intente enlazar al
-- hijo/a de otra usuaria a este expediente.
CREATE FUNCTION "nino_hijo_de_la_usuaria"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "HijoUsuaria" h JOIN "Expediente" e ON e."usuariaId" = h."usuariaId"
    WHERE h.id = NEW."hijoId" AND e.id = NEW."expedienteId"
  ) THEN
    RAISE EXCEPTION 'El hijo/a no pertenece a la usuaria de este expediente'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Nino_hijo_usuaria_chk" BEFORE INSERT OR UPDATE OF "hijoId", "expedienteId" ON "Nino"
  FOR EACH ROW EXECUTE FUNCTION "nino_hijo_de_la_usuaria"();

-- Un hijo/a no cambia de madre: con casos enlazados, la ficha quedaría con la usuaria equivocada.
CREATE FUNCTION "hijo_usuaria_madre_fija"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."usuariaId" <> OLD."usuariaId" THEN
    RAISE EXCEPTION 'La usuaria de un hijo/a no se modifica' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "HijoUsuaria_madre_upd" BEFORE UPDATE OF "usuariaId" ON "HijoUsuaria"
  FOR EACH ROW EXECUTE FUNCTION "hijo_usuaria_madre_fija"();
