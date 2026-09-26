-- CreateEnum
CREATE TYPE "EstadoAtencionPsicologica" AS ENUM ('INICIO', 'SEGUIMIENTO', 'CIERRE');

-- CreateEnum
CREATE TYPE "ModalidadCita" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "EstadoCitaPsicologica" AS ENUM ('PROGRAMADA', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO');

-- AlterEnum
ALTER TYPE "TipoDocumento" ADD VALUE 'FORMATO_ATENCION_PSICOLOGICA';

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "citaPsicologicaId" TEXT;

-- CreateTable
CREATE TABLE "AtencionPsicologica" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "estado" "EstadoAtencionPsicologica" NOT NULL DEFAULT 'INICIO',
    "actualizadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AtencionPsicologica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitaPsicologica" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "fechaHora" TIMESTAMPTZ(3) NOT NULL,
    "modalidad" "ModalidadCita" NOT NULL,
    "lugar" TEXT,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoCitaPsicologica" NOT NULL DEFAULT 'PROGRAMADA',
    "observaciones" TEXT,
    "acuerdos" TEXT,
    "atendidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitaPsicologica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtencionPsicologica_expedienteId_key" ON "AtencionPsicologica"("expedienteId");

-- CreateIndex
CREATE INDEX "CitaPsicologica_atencionId_idx" ON "CitaPsicologica"("atencionId");

-- CreateIndex
CREATE INDEX "CitaPsicologica_fechaHora_idx" ON "CitaPsicologica"("fechaHora");

-- CreateIndex
CREATE INDEX "Documento_citaPsicologicaId_idx" ON "Documento"("citaPsicologicaId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_citaPsicologicaId_fkey" FOREIGN KEY ("citaPsicologicaId") REFERENCES "CitaPsicologica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "AtencionPsicologica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_atendidoPorId_fkey" FOREIGN KEY ("atendidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
