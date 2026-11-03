-- Un hijo/a tiene a lo más un proceso de Psicología abierto, en cualquiera de los expedientes de
-- su madre. Antes el índice parcial era por `ninoId` (su enlace con un caso), así que el mismo
-- hijo/a podía tener un proceso abierto en cada expediente. Ahora que cada hijo/a existe una sola
-- vez (`HijoUsuaria`), el proceso guarda una copia de `hijoId` y el índice va sobre ella.

-- 0) Verificación previa: si ya hay un hijo/a con dos procesos abiertos, se detiene la migración
--    en vez de elegir cuál cerrar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AtencionPsicologica" a
    JOIN "Nino" n ON n.id = a."ninoId"
    WHERE a.estado <> 'CIERRE'
    GROUP BY n."hijoId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay hijos/as con más de un proceso de psicología abierto; revisar a mano';
  END IF;
END $$;

-- 1) Columna y relleno desde el enlace.
ALTER TABLE "AtencionPsicologica" ADD COLUMN "hijoId" TEXT;

UPDATE "AtencionPsicologica" a
SET "hijoId" = n."hijoId"
FROM "Nino" n
WHERE n.id = a."ninoId";

ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_hijoId_fkey"
  FOREIGN KEY ("hijoId") REFERENCES "HijoUsuaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Con hijo/a, siempre su copia; sin hijo/a (la usuaria o un caso sin persona aún), nunca.
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_hijo_chk"
  CHECK (("ninoId" IS NULL) = ("hijoId" IS NULL));

-- 2) La copia la mantiene la base: lo que envíe la app se ignora.
CREATE FUNCTION "atencion_psicologica_hijo"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ninoId" IS NULL THEN
    NEW."hijoId" := NULL;
  ELSE
    SELECT n."hijoId" INTO NEW."hijoId" FROM "Nino" n WHERE n.id = NEW."ninoId";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "AtencionPsicologica_hijo_ins" BEFORE INSERT ON "AtencionPsicologica"
  FOR EACH ROW EXECUTE FUNCTION "atencion_psicologica_hijo"();
CREATE TRIGGER "AtencionPsicologica_hijo_upd" BEFORE UPDATE OF "ninoId", "hijoId" ON "AtencionPsicologica"
  FOR EACH ROW EXECUTE FUNCTION "atencion_psicologica_hijo"();

-- La copia solo se queda al día si el enlace no cambia de hijo/a: igual que su número y su
-- expediente (`nino_identidad_inmutable`), quién es el hijo/a de un enlace no se modifica.
CREATE FUNCTION "nino_hijo_inmutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."hijoId" <> OLD."hijoId" THEN
    RAISE EXCEPTION 'El hijo/a de un caso no se cambia por otro'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Nino_hijo_upd" BEFORE UPDATE OF "hijoId" ON "Nino"
  FOR EACH ROW EXECUTE FUNCTION "nino_hijo_inmutable"();

-- 3) El índice nuevo es más estricto que el anterior (un hijo/a ⊇ uno de sus enlaces): lo reemplaza.
CREATE UNIQUE INDEX "AtencionPsicologica_activa_hijo_uq" ON "AtencionPsicologica"("hijoId")
  WHERE "hijoId" IS NOT NULL AND estado <> 'CIERRE';
DROP INDEX "AtencionPsicologica_activa_nino_uq";

-- 4) Verificación final: cada proceso con hijo/a quedó con su copia.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AtencionPsicologica" a
    JOIN "Nino" n ON n.id = a."ninoId"
    WHERE a."hijoId" IS DISTINCT FROM n."hijoId"
  ) THEN
    RAISE EXCEPTION 'Quedaron procesos sin la copia correcta del hijo/a';
  END IF;
END $$;
