-- CreateTable
CREATE TABLE "ReasignacionAtencionPsicologica" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "dePsicologaId" TEXT NOT NULL,
    "aPsicologaId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasignacionAtencionPsicologica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReasignacionAtencionPsicologica_atencionId_idx" ON "ReasignacionAtencionPsicologica"("atencionId");

-- AddForeignKey
ALTER TABLE "ReasignacionAtencionPsicologica" ADD CONSTRAINT "ReasignacionAtencionPsicologica_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "AtencionPsicologica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasignacionAtencionPsicologica" ADD CONSTRAINT "ReasignacionAtencionPsicologica_dePsicologaId_fkey" FOREIGN KEY ("dePsicologaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasignacionAtencionPsicologica" ADD CONSTRAINT "ReasignacionAtencionPsicologica_aPsicologaId_fkey" FOREIGN KEY ("aPsicologaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
