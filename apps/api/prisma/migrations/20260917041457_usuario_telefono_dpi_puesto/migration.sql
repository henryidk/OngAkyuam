-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "dpi" TEXT,
ADD COLUMN     "puesto" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dpi_key" ON "Usuario"("dpi");
