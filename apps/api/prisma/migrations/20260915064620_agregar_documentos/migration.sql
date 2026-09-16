-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('ENTREVISTA_USUARIA', 'CONVENIO_INGRESO', 'RECEPCION_BIENES');

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "claveR2" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoVisibilidadArea" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "area" "Rol" NOT NULL,
    "otorgadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoVisibilidadArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Documento_claveR2_key" ON "Documento"("claveR2");

-- CreateIndex
CREATE INDEX "Documento_expedienteId_idx" ON "Documento"("expedienteId");

-- CreateIndex
CREATE INDEX "DocumentoVisibilidadArea_area_idx" ON "DocumentoVisibilidadArea"("area");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoVisibilidadArea_documentoId_area_key" ON "DocumentoVisibilidadArea"("documentoId", "area");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVisibilidadArea" ADD CONSTRAINT "DocumentoVisibilidadArea_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVisibilidadArea" ADD CONSTRAINT "DocumentoVisibilidadArea_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
