-- El tipo de actuación de la bitácora pasa de lista fija a texto libre, y las entradas que genera
-- el sistema se marcan con `esSistema` en vez de con el valor SISTEMA del enum.
-- Escrita a mano: Prisma proponía borrar y recrear la columna, lo que perdería el tipo de cada
-- entrada. Aquí el valor se copia antes de borrar nada; ninguna fila se elimina.

-- 1. Columnas nuevas.
ALTER TABLE "NotaAvanceProceso"
  ADD COLUMN "esSistema" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tipoTexto" VARCHAR(60);

-- 2. Copia de cada valor del enum a su etiqueta en texto (las mismas que mostraba la pantalla).
UPDATE "NotaAvanceProceso"
SET
  "esSistema" = ("tipo" = 'SISTEMA'),
  "tipoTexto" = CASE "tipo"
    WHEN 'SEGUIMIENTO' THEN 'Seguimiento'
    WHEN 'ESCRITO' THEN 'Escrito'
    WHEN 'NOTIFICACION' THEN 'Notificación'
    WHEN 'RESOLUCION' THEN 'Resolución'
    WHEN 'AUDIENCIA' THEN 'Audiencia'
    WHEN 'DILIGENCIA' THEN 'Diligencia'
    WHEN 'CONTACTO_USUARIA' THEN 'Contacto con usuaria'
    WHEN 'SISTEMA' THEN 'Sistema'
  END;

-- 3. Se reemplaza la columna vieja por la nueva. NOT NULL falla (y revierte toda la migración)
-- si algún valor no se copió.
ALTER TABLE "NotaAvanceProceso" ALTER COLUMN "tipoTexto" SET NOT NULL;
ALTER TABLE "NotaAvanceProceso" DROP COLUMN "tipo";
ALTER TABLE "NotaAvanceProceso" RENAME COLUMN "tipoTexto" TO "tipo";

-- DropEnum
DROP TYPE "TipoEntradaBitacora";
