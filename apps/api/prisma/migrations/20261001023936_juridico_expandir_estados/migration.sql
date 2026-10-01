-- CreateEnum
CREATE TYPE "FaseProcesoJuridico" AS ENUM ('INICIADO', 'EN_PROCESO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "SituacionProcesoJuridico" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'ABANDONADO');

-- CreateEnum
CREATE TYPE "FormaFinalizacionProceso" AS ENUM ('CONVENIO', 'SENTENCIA', 'DESISTIMIENTO', 'OTROS');

-- CreateEnum
CREATE TYPE "MotivoAbandonoProceso" AS ENUM ('NO_RESPONDE', 'CAMBIO_DOMICILIO', 'ABOGADO_PARTICULAR', 'RECONCILIACION', 'NO_SE_PRESENTO_AUDIENCIAS', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoEntradaBitacora" AS ENUM ('SEGUIMIENTO', 'ESCRITO', 'NOTIFICACION', 'RESOLUCION', 'AUDIENCIA', 'DILIGENCIA', 'CONTACTO_USUARIA', 'SISTEMA');

-- DropIndex
DROP INDEX "NotaAvanceProceso_procesoId_idx";

-- AlterTable
ALTER TABLE "AbandonoProceso" ADD COLUMN     "intentosContacto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "motivoCatalogo" "MotivoAbandonoProceso",
ADD COLUMN     "notificadoATs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reactivadoEn" TIMESTAMPTZ(3),
ADD COLUMN     "ultimoContacto" DATE;

-- AlterTable
ALTER TABLE "DocumentoProceso" ADD COLUMN     "carpetaId" TEXT;

-- AlterTable
ALTER TABLE "NotaAvanceProceso" ADD COLUMN     "tipo" "TipoEntradaBitacora" NOT NULL DEFAULT 'SEGUIMIENTO';

-- AlterTable
ALTER TABLE "ProcesoJuridico" ADD COLUMN     "consecutivo" INTEGER,
ADD COLUMN     "contraparte" VARCHAR(160),
ADD COLUMN     "detalleFinalizacion" VARCHAR(300),
ADD COLUMN     "fase" "FaseProcesoJuridico",
ADD COLUMN     "formaFinalizacion" "FormaFinalizacionProceso",
ADD COLUMN     "numeroJudicial" VARCHAR(60),
ADD COLUMN     "organoJudicial" VARCHAR(160),
ADD COLUMN     "procesoOrigenId" TEXT,
ADD COLUMN     "referidoId" TEXT,
ADD COLUMN     "situacion" "SituacionProcesoJuridico",
ADD COLUMN     "ultimaActuacionEn" TIMESTAMPTZ(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ReferidoArea" ADD COLUMN     "atendidoEn" TIMESTAMPTZ(3),
ADD COLUMN     "devueltoEn" TIMESTAMPTZ(3),
ADD COLUMN     "devueltoPorId" TEXT,
ADD COLUMN     "motivoDevolucion" VARCHAR(500),
ADD COLUMN     "procesosSugeridos" "TipoProcesoJuridico"[] DEFAULT ARRAY[]::"TipoProcesoJuridico"[];

-- CreateTable
CREATE TABLE "SuspensionProceso" (
    "id" TEXT NOT NULL,
    "procesoId" TEXT NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMPTZ(3),
    "registradoPorId" TEXT NOT NULL,

    CONSTRAINT "SuspensionProceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarpetaDocumentoProceso" (
    "id" TEXT NOT NULL,
    "procesoId" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "nombreNorm" VARCHAR(80) NOT NULL,
    "creadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CarpetaDocumentoProceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuspensionProceso_procesoId_idx" ON "SuspensionProceso"("procesoId");

-- CreateIndex
CREATE UNIQUE INDEX "CarpetaDocumentoProceso_procesoId_nombreNorm_key" ON "CarpetaDocumentoProceso"("procesoId", "nombreNorm");

-- CreateIndex
CREATE INDEX "DocumentoProceso_carpetaId_idx" ON "DocumentoProceso"("carpetaId");

-- CreateIndex
CREATE INDEX "NotaAvanceProceso_procesoId_createdAt_idx" ON "NotaAvanceProceso"("procesoId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReferidoArea" ADD CONSTRAINT "ReferidoArea_devueltoPorId_fkey" FOREIGN KEY ("devueltoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_procesoOrigenId_fkey" FOREIGN KEY ("procesoOrigenId") REFERENCES "ProcesoJuridico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_referidoId_fkey" FOREIGN KEY ("referidoId") REFERENCES "ReferidoArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionProceso" ADD CONSTRAINT "SuspensionProceso_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionProceso" ADD CONSTRAINT "SuspensionProceso_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpetaDocumentoProceso" ADD CONSTRAINT "CarpetaDocumentoProceso_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarpetaDocumentoProceso" ADD CONSTRAINT "CarpetaDocumentoProceso_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoProceso" ADD CONSTRAINT "DocumentoProceso_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "CarpetaDocumentoProceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
