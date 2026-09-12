-- CreateTable
CREATE TABLE "ReferidoArea" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "area" "Rol" NOT NULL,
    "otorgadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferidoArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferidoArea_area_idx" ON "ReferidoArea"("area");

-- CreateIndex
CREATE UNIQUE INDEX "ReferidoArea_expedienteId_area_key" ON "ReferidoArea"("expedienteId", "area");

-- AddForeignKey
ALTER TABLE "ReferidoArea" ADD CONSTRAINT "ReferidoArea_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferidoArea" ADD CONSTRAINT "ReferidoArea_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
