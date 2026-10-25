/*
  Warnings:

  - You are about to drop the column `devueltoEn` on the `ReferidoArea` table. All the data in the column will be lost.
  - You are about to drop the column `devueltoPorId` on the `ReferidoArea` table. All the data in the column will be lost.
  - You are about to drop the column `motivoDevolucion` on the `ReferidoArea` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReferidoArea" DROP CONSTRAINT "ReferidoArea_devueltoPorId_fkey";

-- AlterTable
ALTER TABLE "ReferidoArea" DROP COLUMN "devueltoEn",
DROP COLUMN "devueltoPorId",
DROP COLUMN "motivoDevolucion";
