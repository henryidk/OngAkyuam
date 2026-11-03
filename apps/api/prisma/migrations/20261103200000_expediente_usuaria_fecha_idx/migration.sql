-- "Usuaria nueva" del reporte de Trabajo Social: el primer expediente de cada usuaria
-- (min(fecha) por usuariaId). El índice compuesto cubre también las búsquedas por usuariaId
-- sola, así que reemplaza al índice simple. No toca datos.

-- CreateIndex
CREATE INDEX "Expediente_usuariaId_fecha_idx" ON "Expediente"("usuariaId", "fecha");

-- DropIndex
DROP INDEX "Expediente_usuariaId_idx";
