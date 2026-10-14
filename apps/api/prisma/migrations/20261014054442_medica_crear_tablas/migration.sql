-- CreateEnum
CREATE TYPE "EstadoAtencionMedica" AS ENUM ('ACTIVA', 'ALTA');

-- CreateEnum
CREATE TYPE "MotivoAltaMedica" AS ENUM ('ALTA_MEDICA', 'REFERIDA_OTRA_INSTITUCION', 'DEJO_DE_ASISTIR', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCitaMedica" AS ENUM ('PROGRAMADA', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoDocumentoMedico" AS ENUM ('RESULTADO_LABORATORIO', 'RECETA', 'ORDEN_MEDICA', 'CONSTANCIA', 'IMAGEN', 'OTRO');

-- CreateTable
CREATE TABLE "AtencionMedica" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "consecutivo" INTEGER NOT NULL,
    "estado" "EstadoAtencionMedica" NOT NULL DEFAULT 'ACTIVA',
    "referidoId" TEXT,
    "medicaId" TEXT,
    "fechaInicio" DATE NOT NULL,
    "fechaAlta" DATE,
    "motivoAlta" "MotivoAltaMedica",
    "notaAlta" VARCHAR(500),
    "visibleJuridico" BOOLEAN NOT NULL DEFAULT false,
    "visiblePsicologia" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AtencionMedica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitaMedica" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "ninoId" TEXT,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "duracionMin" INTEGER NOT NULL DEFAULT 30,
    "estado" "EstadoCitaMedica" NOT NULL DEFAULT 'PROGRAMADA',
    "reprogramadaDesdeId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CitaMedica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultaMedica" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "citaId" TEXT,
    "ninoId" TEXT,
    "fechaHora" TIMESTAMPTZ(3) NOT NULL,
    "motivoConsulta" VARCHAR(2000),
    "presionSistolica" SMALLINT,
    "presionDiastolica" SMALLINT,
    "frecuenciaCardiaca" SMALLINT,
    "frecuenciaResp" SMALLINT,
    "temperaturaC" DECIMAL(4,1),
    "saturacionO2" SMALLINT,
    "glucosaMgDl" SMALLINT,
    "pesoKg" DECIMAL(5,2),
    "tallaM" DECIMAL(3,2),
    "diagnostico" VARCHAR(2000) NOT NULL,
    "planTratamiento" VARCHAR(4000),
    "recetaLaboratorios" VARCHAR(4000),
    "registradaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultaMedica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoMedico" (
    "id" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "tipo" "TipoDocumentoMedico" NOT NULL,
    "nombreVisible" VARCHAR(120) NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "claveObjeto" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoMedico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoMedicoPendiente" (
    "id" TEXT NOT NULL,
    "lote" UUID NOT NULL,
    "tipo" "TipoDocumentoMedico" NOT NULL,
    "nombreVisible" VARCHAR(120) NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "claveObjeto" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "atencionId" TEXT NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "expiraEn" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoMedicoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtencionMedica_estado_idx" ON "AtencionMedica"("estado");

-- CreateIndex
CREATE INDEX "AtencionMedica_referidoId_idx" ON "AtencionMedica"("referidoId");

-- CreateIndex
CREATE UNIQUE INDEX "AtencionMedica_expedienteId_consecutivo_key" ON "AtencionMedica"("expedienteId", "consecutivo");

-- CreateIndex
CREATE UNIQUE INDEX "CitaMedica_reprogramadaDesdeId_key" ON "CitaMedica"("reprogramadaDesdeId");

-- CreateIndex
CREATE INDEX "CitaMedica_inicio_idx" ON "CitaMedica"("inicio");

-- CreateIndex
CREATE INDEX "CitaMedica_atencionId_estado_idx" ON "CitaMedica"("atencionId", "estado");

-- CreateIndex
CREATE INDEX "CitaMedica_ninoId_idx" ON "CitaMedica"("ninoId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultaMedica_citaId_key" ON "ConsultaMedica"("citaId");

-- CreateIndex
CREATE INDEX "ConsultaMedica_atencionId_fechaHora_idx" ON "ConsultaMedica"("atencionId", "fechaHora");

-- CreateIndex
CREATE INDEX "ConsultaMedica_ninoId_idx" ON "ConsultaMedica"("ninoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoMedico_claveObjeto_key" ON "DocumentoMedico"("claveObjeto");

-- CreateIndex
CREATE INDEX "DocumentoMedico_consultaId_idx" ON "DocumentoMedico"("consultaId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoMedicoPendiente_claveObjeto_key" ON "DocumentoMedicoPendiente"("claveObjeto");

-- CreateIndex
CREATE INDEX "DocumentoMedicoPendiente_lote_subidoPorId_idx" ON "DocumentoMedicoPendiente"("lote", "subidoPorId");

-- CreateIndex
CREATE INDEX "DocumentoMedicoPendiente_expiraEn_idx" ON "DocumentoMedicoPendiente"("expiraEn");

-- AddForeignKey
ALTER TABLE "AtencionMedica" ADD CONSTRAINT "AtencionMedica_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionMedica" ADD CONSTRAINT "AtencionMedica_referidoId_fkey" FOREIGN KEY ("referidoId") REFERENCES "ReferidoArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionMedica" ADD CONSTRAINT "AtencionMedica_medicaId_fkey" FOREIGN KEY ("medicaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionMedica" ADD CONSTRAINT "AtencionMedica_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "AtencionMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_ninoId_fkey" FOREIGN KEY ("ninoId") REFERENCES "Nino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_reprogramadaDesdeId_fkey" FOREIGN KEY ("reprogramadaDesdeId") REFERENCES "CitaMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultaMedica" ADD CONSTRAINT "ConsultaMedica_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "AtencionMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultaMedica" ADD CONSTRAINT "ConsultaMedica_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "CitaMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultaMedica" ADD CONSTRAINT "ConsultaMedica_ninoId_fkey" FOREIGN KEY ("ninoId") REFERENCES "Nino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultaMedica" ADD CONSTRAINT "ConsultaMedica_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoMedico" ADD CONSTRAINT "DocumentoMedico_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "ConsultaMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoMedico" ADD CONSTRAINT "DocumentoMedico_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoMedicoPendiente" ADD CONSTRAINT "DocumentoMedicoPendiente_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
