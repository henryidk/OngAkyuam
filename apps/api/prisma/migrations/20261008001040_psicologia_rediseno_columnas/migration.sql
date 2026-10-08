-- Rediseño de Psicología, paso 1 de 4 (expandir): solo agrega. Ninguna columna existente cambia
-- de tipo ni se borra, así que el código actual sigue funcionando sin cambios.
--  - Proceso: consecutivo (para el código "P1-05-2026"), motivo de cierre de catálogo y resumen,
--    visibilidad para Jurídico y Médica, referencia de origen y versión (concurrencia optimista).
--    Los procesos existentes quedan con consecutivo 1: hoy hay a lo sumo uno por expediente.
--  - Cita: hijo/a atendido (ninoId). `modalidad` y `motivo` reciben un valor por defecto porque
--    el formulario nuevo ya no los pide.

-- CreateEnum
CREATE TYPE "MotivoCierrePsicologia" AS ENUM ('OBJETIVOS_CUMPLIDOS', 'DEJO_DE_ASISTIR', 'REFERIDA_OTRA_INSTITUCION', 'DECISION_USUARIA', 'OTRO');

-- AlterTable
ALTER TABLE "AtencionPsicologica" ADD COLUMN     "consecutivo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "motivoCierreCatalogo" "MotivoCierrePsicologia",
ADD COLUMN     "referidoId" TEXT,
ADD COLUMN     "resumenCierre" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "visibleJuridico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibleMedica" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CitaPsicologica" ADD COLUMN     "ninoId" TEXT,
ALTER COLUMN "modalidad" SET DEFAULT 'PRESENCIAL',
ALTER COLUMN "motivo" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "AtencionPsicologica_referidoId_idx" ON "AtencionPsicologica"("referidoId");

-- CreateIndex
CREATE INDEX "CitaPsicologica_ninoId_idx" ON "CitaPsicologica"("ninoId");

-- AddForeignKey
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_referidoId_fkey" FOREIGN KEY ("referidoId") REFERENCES "ReferidoArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_ninoId_fkey" FOREIGN KEY ("ninoId") REFERENCES "Nino"("id") ON DELETE SET NULL ON UPDATE CASCADE;
