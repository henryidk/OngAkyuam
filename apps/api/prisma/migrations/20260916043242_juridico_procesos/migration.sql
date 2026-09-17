-- CreateEnum
CREATE TYPE "TipoPersonalJuridico" AS ENUM ('ABOGADA', 'PROCURADORA');

-- CreateEnum
CREATE TYPE "TipoProcesoJuridico" AS ENUM ('FIJACION_PENSION_ALIMENTICIA', 'MODIFICACION_PENSION_ALIMENTICIA', 'DIVORCIO_MUTUO_ACUERDO', 'DIVORCIO_CAUSAL_DETERMINADA', 'PATERNIDAD_FILIACION', 'EJECUCION_VIA_APREMIO', 'JUICIO_EJECUTIVO', 'GUARDA_CUSTODIA', 'MEDIDAS_SEGURIDAD', 'MENAJE_CASA', 'RELACIONES_FAMILIARES', 'RECONOCIMIENTO_PRENEZ_PARTO', 'REFERENCIA_PGN', 'ORDINARIO_LABORAL', 'INSCRIPCION_RENAP');

-- CreateEnum
CREATE TYPE "EstadoProcesoJuridico" AS ENUM ('INICIADO', 'CERRADO');

-- CreateTable
CREATE TABLE "PersonalJuridico" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPersonalJuridico" NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PersonalJuridico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcesoJuridico" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "tipo" "TipoProcesoJuridico" NOT NULL,
    "estado" "EstadoProcesoJuridico" NOT NULL DEFAULT 'INICIADO',
    "abogadaId" TEXT,
    "procuradoraId" TEXT,
    "fechaInicio" DATE NOT NULL,
    "fechaCierre" DATE,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProcesoJuridico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbandonoProceso" (
    "id" TEXT NOT NULL,
    "procesoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonoProceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaAvanceProceso" (
    "id" TEXT NOT NULL,
    "procesoId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaAvanceProceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoProceso" (
    "id" TEXT NOT NULL,
    "procesoId" TEXT NOT NULL,
    "nombreVisible" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "claveR2" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoProceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalJuridico_tipo_activo_idx" ON "PersonalJuridico"("tipo", "activo");

-- CreateIndex
CREATE INDEX "ProcesoJuridico_expedienteId_idx" ON "ProcesoJuridico"("expedienteId");

-- CreateIndex
CREATE INDEX "ProcesoJuridico_estado_idx" ON "ProcesoJuridico"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonoProceso_procesoId_key" ON "AbandonoProceso"("procesoId");

-- CreateIndex
CREATE INDEX "NotaAvanceProceso_procesoId_idx" ON "NotaAvanceProceso"("procesoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoProceso_claveR2_key" ON "DocumentoProceso"("claveR2");

-- CreateIndex
CREATE INDEX "DocumentoProceso_procesoId_idx" ON "DocumentoProceso"("procesoId");

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_abogadaId_fkey" FOREIGN KEY ("abogadaId") REFERENCES "PersonalJuridico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_procuradoraId_fkey" FOREIGN KEY ("procuradoraId") REFERENCES "PersonalJuridico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonoProceso" ADD CONSTRAINT "AbandonoProceso_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonoProceso" ADD CONSTRAINT "AbandonoProceso_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaAvanceProceso" ADD CONSTRAINT "NotaAvanceProceso_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaAvanceProceso" ADD CONSTRAINT "NotaAvanceProceso_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoProceso" ADD CONSTRAINT "DocumentoProceso_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoProceso" ADD CONSTRAINT "DocumentoProceso_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
