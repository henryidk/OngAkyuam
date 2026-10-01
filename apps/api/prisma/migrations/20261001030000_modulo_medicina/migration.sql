CREATE TABLE "AtencionMedica" (
  "id" TEXT NOT NULL,
  "expedienteId" TEXT NOT NULL,
  "perfil" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AtencionMedica_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CitaMedica" (
  "id" TEXT NOT NULL,
  "atencionId" TEXT NOT NULL,
  "fecha" DATE NOT NULL,
  "hora" TEXT NOT NULL,
  "lugar" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'Programada',
  "nota" JSONB,
  "atendidoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CitaMedica_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AtencionMedica_expedienteId_key" ON "AtencionMedica"("expedienteId");
CREATE INDEX "CitaMedica_atencionId_idx" ON "CitaMedica"("atencionId");
CREATE UNIQUE INDEX "CitaMedica_atendidoPorId_fecha_hora_key" ON "CitaMedica"("atendidoPorId", "fecha", "hora");
ALTER TABLE "AtencionMedica" ADD CONSTRAINT "AtencionMedica_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "AtencionMedica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_atendidoPorId_fkey" FOREIGN KEY ("atendidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
