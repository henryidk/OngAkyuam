-- CreateEnum
CREATE TYPE "PrioridadReferido" AS ENUM ('NORMAL', 'URGENTE');

-- AlterTable
ALTER TABLE "ReferidoArea" ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "prioridad" "PrioridadReferido" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "profesionalAsignadoId" TEXT,
ADD COLUMN     "puedeVerDatosCaso" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "ReferidoArea" ADD CONSTRAINT "ReferidoArea_profesionalAsignadoId_fkey" FOREIGN KEY ("profesionalAsignadoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

