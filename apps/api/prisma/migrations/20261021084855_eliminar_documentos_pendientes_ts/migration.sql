/*
  Warnings:

  - You are about to drop the `DocumentoPendiente` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentoPendiente" DROP CONSTRAINT "DocumentoPendiente_subidoPorId_fkey";

-- DropTable
DROP TABLE "DocumentoPendiente";
