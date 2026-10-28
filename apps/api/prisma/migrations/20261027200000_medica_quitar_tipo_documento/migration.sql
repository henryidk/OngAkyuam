-- Los documentos médicos ya no llevan tipo: quedan vinculados a su consulta con su nombre, y
-- Jurídico ve todos los de las atenciones que Medicina le comparte (antes solo las constancias).
-- Confirmado con el usuario: no hay datos reales, solo se pierde la etiqueta de los de prueba.

-- AlterTable
ALTER TABLE "DocumentoMedico" DROP COLUMN "tipo";

-- AlterTable
ALTER TABLE "DocumentoMedicoPendiente" DROP COLUMN "tipo";

-- DropEnum
DROP TYPE "TipoDocumentoMedico";
