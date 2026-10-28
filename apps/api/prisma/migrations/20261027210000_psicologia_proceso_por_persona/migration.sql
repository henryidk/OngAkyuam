-- Psicología: un proceso por persona (la usuaria y cada hijo/a), número estable por hijo/a,
-- clínica y enfoque terapéutico de la sesión. Ver planpsicologiaequipo.md. No borra columnas
-- ni datos: las citas de hijos que estaban dentro del proceso de la madre pasan a procesos
-- propios, con sus documentos (que siguen a la cita) y una copia de los hitos y reasignaciones.

-- CreateEnum
CREATE TYPE "ClinicaPsicologia" AS ENUM ('CLINICA_1', 'CLINICA_2');

-- AlterTable
ALTER TABLE "CitaPsicologica" ADD COLUMN "clinica" "ClinicaPsicologia",
ADD COLUMN "enfoqueTerapeutico" TEXT;

-- ---- Número del hijo/a dentro del expediente ----

ALTER TABLE "Nino" ADD COLUMN "consecutivo" INTEGER NOT NULL DEFAULT 0;

-- Los existentes se numeran del mayor al menor, como se suelen anotar en el expediente.
UPDATE "Nino" n SET "consecutivo" = o.fila
FROM (
  SELECT id, row_number() OVER (PARTITION BY "expedienteId" ORDER BY "fechaNacimiento", id) AS fila
  FROM "Nino"
) o
WHERE o.id = n.id;

ALTER TABLE "Nino" ADD CONSTRAINT "Nino_consecutivo_chk" CHECK ("consecutivo" >= 1);
CREATE UNIQUE INDEX "Nino_expedienteId_consecutivo_key" ON "Nino"("expedienteId", "consecutivo");
CREATE UNIQUE INDEX "Nino_id_expedienteId_key" ON "Nino"("id", "expedienteId");

-- El número lo asigna la base para que no dependa de quién crea al hijo/a (el valor enviado se
-- ignora). El bloqueo del expediente ordena dos altas simultáneas; NO KEY UPDATE no estorba a
-- las llaves foráneas que apuntan al expediente.
CREATE FUNCTION "nino_asignar_consecutivo"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Expediente" WHERE id = NEW."expedienteId" FOR NO KEY UPDATE;
  SELECT COALESCE(MAX("consecutivo"), 0) + 1 INTO NEW."consecutivo"
  FROM "Nino" WHERE "expedienteId" = NEW."expedienteId";
  RETURN NEW;
END $$;

CREATE TRIGGER "Nino_consecutivo_ins" BEFORE INSERT ON "Nino"
  FOR EACH ROW EXECUTE FUNCTION "nino_asignar_consecutivo"();

-- Un número que ya identifica a alguien en papeles y procesos no cambia, ni el expediente del hijo/a.
CREATE FUNCTION "nino_identidad_inmutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."consecutivo" <> OLD."consecutivo" OR NEW."expedienteId" <> OLD."expedienteId" THEN
    RAISE EXCEPTION 'El número y el expediente de un hijo/a no se modifican'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Nino_identidad_upd" BEFORE UPDATE OF "consecutivo", "expedienteId" ON "Nino"
  FOR EACH ROW EXECUTE FUNCTION "nino_identidad_inmutable"();

-- ---- Persona del proceso ----

ALTER TABLE "AtencionPsicologica" ADD COLUMN "ninoId" TEXT;

-- Las unicidades por expediente pasan a ser por persona (se recrean al final).
DROP INDEX "AtencionPsicologica_expedienteId_consecutivo_key";
DROP INDEX "AtencionPsicologica_activa_uq";

-- Lo clínico no se borra con el hijo/a: solo cae junto con el expediente completo.
ALTER TABLE "CitaPsicologica" DROP CONSTRAINT "CitaPsicologica_ninoId_fkey";
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_ninoId_fkey" FOREIGN KEY ("ninoId") REFERENCES "Nino"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- La llave compuesta hace que la base rechace un hijo/a de otro expediente.
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_ninoId_expedienteId_fkey" FOREIGN KEY ("ninoId", "expedienteId") REFERENCES "Nino"("id", "expedienteId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Si quedó una cita con un hijo/a de otro expediente (la app no lo permitía, la base sí), se
-- detiene la migración en vez de inventar a quién pertenece.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CitaPsicologica" c
    JOIN "AtencionPsicologica" a ON a.id = c."atencionId"
    JOIN "Nino" n ON n.id = c."ninoId"
    WHERE n."expedienteId" <> a."expedienteId"
  ) THEN
    RAISE EXCEPTION 'Hay citas de psicología con un hijo/a de otro expediente; revisar a mano';
  END IF;
END $$;

-- 1) Procesos que solo tienen citas de un mismo hijo/a: eran en realidad su proceso.
UPDATE "AtencionPsicologica" a SET "ninoId" = u."ninoId"
FROM (
  SELECT "atencionId", MIN("ninoId") AS "ninoId"
  FROM "CitaPsicologica"
  GROUP BY "atencionId"
  HAVING COUNT(*) FILTER (WHERE "ninoId" IS NULL) = 0 AND COUNT(DISTINCT "ninoId") = 1
) u
WHERE u."atencionId" = a.id;

-- 2) Procesos con citas de varias personas: cada hijo/a recibe un proceso propio con los datos
-- del original (responsable, referencia, visibilidad, etapa y cierre) y se lleva sus citas.
CREATE TEMP TABLE "separacion_psicologia" ON COMMIT DROP AS
SELECT gen_random_uuid()::text AS "nuevoId", c."atencionId", c."ninoId",
       MIN(c."fechaHora") AS "primeraCita", MIN(c."createdAt") AS "creada"
FROM "CitaPsicologica" c
JOIN "AtencionPsicologica" a ON a.id = c."atencionId"
WHERE c."ninoId" IS NOT NULL AND c."ninoId" IS DISTINCT FROM a."ninoId"
GROUP BY c."atencionId", c."ninoId";

INSERT INTO "AtencionPsicologica" (
  id, "expedienteId", "ninoId", estado, "psicologaAsignadaId", "tomadaEn", "fechaInicio",
  "fechaCierre", consecutivo, "motivoCierreCatalogo", "resumenCierre", "visibleJuridico",
  "visibleMedica", "referidoId", version, "actualizadoPorId", "createdAt", "updatedAt"
)
SELECT s."nuevoId", a."expedienteId", s."ninoId", a.estado, a."psicologaAsignadaId", a."tomadaEn",
       LEAST(COALESCE(a."fechaInicio", s."primeraCita"), s."primeraCita"),
       a."fechaCierre", 1, a."motivoCierreCatalogo", a."resumenCierre", a."visibleJuridico",
       a."visibleMedica", a."referidoId", 1, a."actualizadoPorId", s."creada", now()
FROM "separacion_psicologia" s
JOIN "AtencionPsicologica" a ON a.id = s."atencionId";

UPDATE "CitaPsicologica" c SET "atencionId" = s."nuevoId"
FROM "separacion_psicologia" s
WHERE c."atencionId" = s."atencionId" AND c."ninoId" = s."ninoId";

INSERT INTO "CambioEstadoAtencion" (id, "atencionId", "estadoAnterior", "estadoNuevo", motivo, "registradoPorId", "createdAt")
SELECT gen_random_uuid()::text, s."nuevoId", h."estadoAnterior", h."estadoNuevo", h.motivo, h."registradoPorId", h."createdAt"
FROM "separacion_psicologia" s
JOIN "CambioEstadoAtencion" h ON h."atencionId" = s."atencionId";

INSERT INTO "ReasignacionAtencionPsicologica" (id, "atencionId", "dePsicologaId", "aPsicologaId", "createdAt")
SELECT gen_random_uuid()::text, s."nuevoId", r."dePsicologaId", r."aPsicologaId", r."createdAt"
FROM "separacion_psicologia" s
JOIN "ReasignacionAtencionPsicologica" r ON r."atencionId" = s."atencionId";

-- 3) Consecutivo por persona, en el orden en que se abrieron sus procesos.
UPDATE "AtencionPsicologica" a SET consecutivo = o.fila
FROM (
  SELECT id, row_number() OVER (PARTITION BY "expedienteId", "ninoId" ORDER BY "createdAt", id) AS fila
  FROM "AtencionPsicologica"
) o
WHERE o.id = a.id AND a.consecutivo <> o.fila;

-- Índices parciales (Prisma no los modela ni propone borrarlos). El de la usuaria es también el
-- que resuelve la carrera de dos psicólogas tomando el mismo caso: la segunda inserción falla.
CREATE UNIQUE INDEX "AtencionPsicologica_consecutivo_usuaria_uq" ON "AtencionPsicologica"("expedienteId", consecutivo) WHERE "ninoId" IS NULL;
CREATE UNIQUE INDEX "AtencionPsicologica_consecutivo_nino_uq" ON "AtencionPsicologica"("ninoId", consecutivo) WHERE "ninoId" IS NOT NULL;
CREATE UNIQUE INDEX "AtencionPsicologica_activa_usuaria_uq" ON "AtencionPsicologica"("expedienteId") WHERE "ninoId" IS NULL AND estado <> 'CIERRE';
CREATE UNIQUE INDEX "AtencionPsicologica_activa_nino_uq" ON "AtencionPsicologica"("ninoId") WHERE "ninoId" IS NOT NULL AND estado <> 'CIERRE';

CREATE INDEX "AtencionPsicologica_expedienteId_idx" ON "AtencionPsicologica"("expedienteId");
CREATE INDEX "AtencionPsicologica_ninoId_idx" ON "AtencionPsicologica"("ninoId");

-- La persona de una cita es siempre la de su proceso.
CREATE FUNCTION "cita_psicologica_persona_del_proceso"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AtencionPsicologica"
    WHERE id = NEW."atencionId" AND "ninoId" IS NOT DISTINCT FROM NEW."ninoId"
  ) THEN
    RAISE EXCEPTION 'La persona de la cita no coincide con la de su proceso'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "CitaPsicologica_persona_chk" BEFORE INSERT OR UPDATE OF "atencionId", "ninoId" ON "CitaPsicologica"
  FOR EACH ROW EXECUTE FUNCTION "cita_psicologica_persona_del_proceso"();

-- La persona de un proceso se elige una vez, antes de su primera cita, y luego no cambia.
CREATE FUNCTION "atencion_psicologica_persona_fija"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ninoId" IS DISTINCT FROM OLD."ninoId"
     AND EXISTS (SELECT 1 FROM "CitaPsicologica" WHERE "atencionId" = OLD.id) THEN
    RAISE EXCEPTION 'La persona de un proceso con citas no se modifica'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "AtencionPsicologica_persona_upd" BEFORE UPDATE OF "ninoId" ON "AtencionPsicologica"
  FOR EACH ROW EXECUTE FUNCTION "atencion_psicologica_persona_fija"();
