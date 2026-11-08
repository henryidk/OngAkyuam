-- Quita la columna "borrador" de CitaPsicologica: el registro de la sesión se guarda de una vez
-- al terminar y ya no existen borradores. El CHECK de atención brindada dependía de ella, así que
-- se rehace sin esa excepción: toda sesión atendida debe decir qué atención se brindó.
-- Si quedara un borrador atendido sin atención brindada, la migración falla en vez de perder datos.
ALTER TABLE "CitaPsicologica" DROP CONSTRAINT "CitaPsicologica_atencion_brindada_chk";

ALTER TABLE "CitaPsicologica" DROP COLUMN "borrador";

ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_atencion_brindada_chk"
  CHECK ("estado" <> 'ATENDIDA' OR COALESCE(length(btrim("atencionBrindada")), 0) > 0);
