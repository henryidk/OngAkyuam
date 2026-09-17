/*
  Warnings:

  - You are about to drop the `PersonalJuridico` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProcesoJuridico" DROP CONSTRAINT "ProcesoJuridico_abogadaId_fkey";

-- DropForeignKey
ALTER TABLE "ProcesoJuridico" DROP CONSTRAINT "ProcesoJuridico_procuradoraId_fkey";

-- DropTable
DROP TABLE "PersonalJuridico";

-- DropEnum
DROP TYPE "TipoPersonalJuridico";

-- CreateTable
CREATE TABLE "Personal" (
    "id" TEXT NOT NULL,
    "area" "Rol" NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Personal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Personal_area_tipo_activo_idx" ON "Personal"("area", "tipo", "activo");

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_abogadaId_fkey" FOREIGN KEY ("abogadaId") REFERENCES "Personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoJuridico" ADD CONSTRAINT "ProcesoJuridico_procuradoraId_fkey" FOREIGN KEY ("procuradoraId") REFERENCES "Personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
