-- AlterTable
ALTER TABLE "DocumentoProceso" ADD COLUMN     "actuacionId" TEXT;

-- CreateIndex
CREATE INDEX "DocumentoProceso_actuacionId_idx" ON "DocumentoProceso"("actuacionId");

-- AddForeignKey
ALTER TABLE "DocumentoProceso" ADD CONSTRAINT "DocumentoProceso_actuacionId_fkey" FOREIGN KEY ("actuacionId") REFERENCES "NotaAvanceProceso"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
