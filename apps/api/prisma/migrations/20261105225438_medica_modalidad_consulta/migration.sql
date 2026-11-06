-- CreateEnum
CREATE TYPE "ModalidadConsultaMedica" AS ENUM ('PRESENCIAL', 'TELEFONICA');

-- AlterTable
ALTER TABLE "ConsultaMedica" ADD COLUMN     "modalidad" "ModalidadConsultaMedica" NOT NULL DEFAULT 'PRESENCIAL';
