-- Mueve municipio/ubicación geográfica/departamento-municipio de origen de Expediente (por
-- caso) a Usuaria (identidad) — ver melodic-yawning-mango.md: estos datos describen dónde vive
-- la usuaria, no el caso puntual, y no tiene sentido volver a pedirlos en cada caso nuevo.

-- AlterTable: agrega las columnas a Usuaria primero (nullable), para poder hacer el backfill
-- antes de perder el dato original de Expediente.
ALTER TABLE "Usuaria" ADD COLUMN     "departamentoOtro" TEXT,
ADD COLUMN     "municipio" "MunicipioAltaVerapaz",
ADD COLUMN     "municipioOtro" TEXT,
ADD COLUMN     "ubicacionGeografica" TEXT;

-- Backfill: cada usuaria toma el valor del expediente más reciente (por fecha) entre los que ya
-- tiene. `DISTINCT ON` + `ORDER BY "usuariaId", "fecha" DESC` selecciona una sola fila por
-- usuaria, la del expediente más nuevo.
UPDATE "Usuaria" AS u
SET "municipio" = e."municipio",
    "departamentoOtro" = e."departamentoOtro",
    "municipioOtro" = e."municipioOtro",
    "ubicacionGeografica" = e."ubicacionGeografica"
FROM (
  SELECT DISTINCT ON ("usuariaId") "usuariaId", "municipio", "departamentoOtro", "municipioOtro", "ubicacionGeografica"
  FROM "Expediente"
  ORDER BY "usuariaId", "fecha" DESC
) AS e
WHERE e."usuariaId" = u."id";

-- CreateIndex
CREATE INDEX "Usuaria_municipio_idx" ON "Usuaria"("municipio");

-- DropIndex
DROP INDEX "Expediente_municipio_idx";

-- AlterTable: ahora sí se puede quitar de Expediente, el dato ya vive en Usuaria.
ALTER TABLE "Expediente" DROP COLUMN "departamentoOtro",
DROP COLUMN "municipio",
DROP COLUMN "municipioOtro",
DROP COLUMN "ubicacionGeografica";
