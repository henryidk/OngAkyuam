-- AlterTable
ALTER TABLE "Expediente" ADD COLUMN     "fechaEgresoAlbergue" DATE,
ADD COLUMN     "fechaIngresoAlbergue" DATE,
ADD COLUMN     "observaciones" TEXT;

-- Backfill: hasta ahora el ingreso al albergue coincidía con la fecha del caso (no existía
-- un campo aparte). Ningún caso tiene egreso registrado todavía, así que queda NULL.
UPDATE "Expediente" SET "fechaIngresoAlbergue" = "fecha" WHERE "tipoRegistro" = 'INTERNA';
