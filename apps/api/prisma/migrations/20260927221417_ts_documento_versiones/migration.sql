-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "reemplazaAId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "vigente" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: antes se podía subir más de un documento del mismo tipo al mismo caso. Se
-- encadenan como versiones por fecha de subida y solo la más reciente queda vigente.
-- FORMATO_ATENCION_PSICOLOGICA se excluye: hay uno por cita, no son versiones entre sí.
WITH versiones AS (
  SELECT "id",
         ROW_NUMBER() OVER w AS numero,
         LAG("id") OVER w AS anterior,
         COUNT(*) OVER (PARTITION BY "expedienteId", "tipo") AS total
  FROM "Documento"
  WHERE "tipo" <> 'FORMATO_ATENCION_PSICOLOGICA'
  WINDOW w AS (PARTITION BY "expedienteId", "tipo" ORDER BY "createdAt", "id")
)
UPDATE "Documento" d
SET "version" = v.numero,
    "reemplazaAId" = v.anterior,
    "vigente" = (v.numero = v.total)
FROM versiones v
WHERE d."id" = v."id" AND v.total > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Documento_reemplazaAId_key" ON "Documento"("reemplazaAId");

-- CreateIndex
CREATE INDEX "Documento_expedienteId_tipo_vigente_idx" ON "Documento"("expedienteId", "tipo", "vigente");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_reemplazaAId_fkey" FOREIGN KEY ("reemplazaAId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

