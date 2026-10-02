-- DropIndex
DROP INDEX "ProcesoJuridico_estado_idx";

-- AlterTable
ALTER TABLE "ProcesoJuridico" DROP COLUMN "estado";

-- DropEnum
DROP TYPE "EstadoProcesoJuridico";

