-- CreateTable
CREATE TABLE "Expediente" (
    "id" TEXT NOT NULL,
    "codigoCaso" TEXT NOT NULL,
    "nombresUsuaria" TEXT NOT NULL,
    "apellidosUsuaria" TEXT NOT NULL,
    "dpi" VARCHAR(13),
    "fechaNacimiento" DATE,
    "edad" INTEGER,
    "genero" TEXT NOT NULL DEFAULT 'Femenino',
    "telefono" TEXT,
    "direccion" TEXT NOT NULL,
    "departamento" TEXT,
    "municipio" TEXT,
    "grupoEtnico" TEXT,
    "ubicacionGeo" TEXT,
    "nombresAgresor" TEXT,
    "apellidosAgresor" TEXT,
    "telefonoAgresor" TEXT,
    "direccionAgresor" TEXT,
    "tipologiasViolencia" TEXT[],
    "condicionRegistro" TEXT NOT NULL,
    "fechaIngreso" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrabajoSocialRegistro" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "observacionesGenerales" TEXT,
    "descripcionHecho" TEXT,
    "observacionesEntrevista" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TrabajoSocialRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoDigital" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "peso" TEXT,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoDigital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Expediente_codigoCaso_key" ON "Expediente"("codigoCaso");

-- CreateIndex
CREATE UNIQUE INDEX "TrabajoSocialRegistro_expedienteId_key" ON "TrabajoSocialRegistro"("expedienteId");

-- AddForeignKey
ALTER TABLE "TrabajoSocialRegistro" ADD CONSTRAINT "TrabajoSocialRegistro_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoDigital" ADD CONSTRAINT "ArchivoDigital_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
