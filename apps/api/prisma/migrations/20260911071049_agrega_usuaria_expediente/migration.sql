-- Necesario para búsqueda difusa por nombre (RF-08) a escala, vía índice GIN trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "TipoRegistro" AS ENUM ('INTERNA', 'EXTERNA');

-- CreateEnum
CREATE TYPE "GeneroPersona" AS ENUM ('MUJER', 'HOMBRE');

-- CreateEnum
CREATE TYPE "GrupoEtnico" AS ENUM ('MAYA_QECHI', 'MAYA_POQOMCHI', 'XINCA', 'GARIFUNA', 'LADINO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipologiaDelito" AS ENUM ('FISICA', 'PSICOLOGICA', 'ECONOMICA_PATRIMONIAL', 'SEXUAL');

-- CreateEnum
CREATE TYPE "MunicipioAltaVerapaz" AS ENUM ('COBAN', 'SANTA_CRUZ_VERAPAZ', 'SAN_CRISTOBAL_VERAPAZ', 'TACTIC', 'TAMAHU', 'TUCURU', 'PANZOS', 'SENAHU', 'SAN_PEDRO_CARCHA', 'SAN_JUAN_CHAMELCO', 'LANQUIN', 'CAHABON', 'CHISEC', 'CHAHAL', 'FRAY_BARTOLOME_DE_LAS_CASAS', 'RAXRUHA', 'SANTA_CATALINA_LA_TINTA');

-- CreateTable
CREATE TABLE "Usuaria" (
    "id" TEXT NOT NULL,
    "dpi" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "fechaNacimiento" DATE NOT NULL,
    "grupoEtnico" "GrupoEtnico" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Usuaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expediente" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "usuariaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "municipio" "MunicipioAltaVerapaz",
    "departamentoOtro" TEXT,
    "municipioOtro" TEXT,
    "ubicacionGeografica" TEXT NOT NULL,
    "tipoRegistro" "TipoRegistro" NOT NULL,
    "tipologiaDelito" "TipologiaDelito"[],
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agresor" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "nombres" TEXT,
    "apellidos" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,

    CONSTRAINT "Agresor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nino" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fechaNacimiento" DATE NOT NULL,
    "genero" "GeneroPersona" NOT NULL,

    CONSTRAINT "Nino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpedienteContador" (
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpedienteContador_pkey" PRIMARY KEY ("anio")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuaria_dpi_key" ON "Usuaria"("dpi");

-- CreateIndex
CREATE INDEX "Usuaria_apellidos_nombres_idx" ON "Usuaria"("apellidos", "nombres");

-- CreateIndex (búsqueda difusa por nombre completo, RF-08)
CREATE INDEX "Usuaria_nombre_trgm_idx" ON "Usuaria" USING GIN ((nombres || ' ' || apellidos) gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Expediente_numero_key" ON "Expediente"("numero");

-- CreateIndex
CREATE INDEX "Expediente_usuariaId_idx" ON "Expediente"("usuariaId");

-- CreateIndex
CREATE INDEX "Expediente_fecha_idx" ON "Expediente"("fecha");

-- CreateIndex
CREATE INDEX "Expediente_creadoPorId_idx" ON "Expediente"("creadoPorId");

-- CreateIndex
CREATE INDEX "Expediente_municipio_idx" ON "Expediente"("municipio");

-- CreateIndex
CREATE UNIQUE INDEX "Agresor_expedienteId_key" ON "Agresor"("expedienteId");

-- CreateIndex
CREATE INDEX "Nino_expedienteId_idx" ON "Nino"("expedienteId");

-- AddForeignKey
ALTER TABLE "Expediente" ADD CONSTRAINT "Expediente_usuariaId_fkey" FOREIGN KEY ("usuariaId") REFERENCES "Usuaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expediente" ADD CONSTRAINT "Expediente_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agresor" ADD CONSTRAINT "Agresor_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nino" ADD CONSTRAINT "Nino_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
