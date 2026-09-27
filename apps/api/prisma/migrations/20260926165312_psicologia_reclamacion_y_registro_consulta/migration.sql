-- CreateEnum
CREATE TYPE "TipoCitaPsicologica" AS ENUM ('PRIMERA_ATENCION', 'SEGUIMIENTO', 'CIERRE');

-- AlterEnum
ALTER TYPE "EstadoCitaPsicologica" ADD VALUE 'REPROGRAMADA';

-- DropIndex
DROP INDEX "CitaPsicologica_atencionId_idx";

-- AlterTable
ALTER TABLE "AtencionPsicologica" ADD COLUMN     "fechaCierre" TIMESTAMPTZ(3),
ADD COLUMN     "fechaInicio" TIMESTAMPTZ(3),
ADD COLUMN     "motivoCierre" TEXT,
ADD COLUMN     "psicologaAsignadaId" TEXT,
ADD COLUMN     "tomadaEn" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CitaPsicologica" ADD COLUMN     "borrador" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "duracionMinutos" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "intervencion" TEXT,
ADD COLUMN     "motivoNoAsistencia" TEXT,
ADD COLUMN     "recomendaciones" TEXT,
ADD COLUMN     "reprogramadaDesdeId" TEXT,
ADD COLUMN     "temas" TEXT,
ADD COLUMN     "tipo" "TipoCitaPsicologica" NOT NULL DEFAULT 'SEGUIMIENTO';

-- CreateTable
CREATE TABLE "CambioEstadoAtencion" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "estadoAnterior" "EstadoAtencionPsicologica",
    "estadoNuevo" "EstadoAtencionPsicologica" NOT NULL,
    "motivo" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioEstadoAtencion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CambioEstadoAtencion_atencionId_idx" ON "CambioEstadoAtencion"("atencionId");

-- CreateIndex
CREATE INDEX "AtencionPsicologica_psicologaAsignadaId_idx" ON "AtencionPsicologica"("psicologaAsignadaId");

-- CreateIndex
CREATE UNIQUE INDEX "CitaPsicologica_reprogramadaDesdeId_key" ON "CitaPsicologica"("reprogramadaDesdeId");

-- CreateIndex
CREATE INDEX "CitaPsicologica_atencionId_fechaHora_idx" ON "CitaPsicologica"("atencionId", "fechaHora");

-- AddForeignKey
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_psicologaAsignadaId_fkey" FOREIGN KEY ("psicologaAsignadaId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioEstadoAtencion" ADD CONSTRAINT "CambioEstadoAtencion_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "AtencionPsicologica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioEstadoAtencion" ADD CONSTRAINT "CambioEstadoAtencion_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_reprogramadaDesdeId_fkey" FOREIGN KEY ("reprogramadaDesdeId") REFERENCES "CitaPsicologica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

