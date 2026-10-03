-- CreateTable
CREATE TABLE "DocumentoPendiente" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "claveR2" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoPendiente_claveR2_key" ON "DocumentoPendiente"("claveR2");

-- CreateIndex
CREATE INDEX "DocumentoPendiente_subidoPorId_idx" ON "DocumentoPendiente"("subidoPorId");

-- CreateIndex
CREATE INDEX "DocumentoPendiente_createdAt_idx" ON "DocumentoPendiente"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentoPendiente" ADD CONSTRAINT "DocumentoPendiente_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
