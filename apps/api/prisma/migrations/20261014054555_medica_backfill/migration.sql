-- Medicina, paso 3 de 3 (relleno). No hay datos clínicos previos que migrar: las referencias de
-- Trabajo Social a MEDICA que ya existen quedan "pendientes de primera consulta" por regla, sin
-- tocar ninguna fila (pendiente = referencia sin atención médica posterior). Esta migración solo
-- lo comprueba: no escribe nada, así que es idempotente y segura en cualquier entorno.
DO $$
DECLARE
  pendientes integer;
  atenciones integer;
BEGIN
  SELECT count(*) INTO atenciones FROM "AtencionMedica";
  IF atenciones > 0 THEN
    RAISE EXCEPTION 'medica_backfill esperaba "AtencionMedica" vacía y encontró % filas', atenciones;
  END IF;

  SELECT count(*) INTO pendientes FROM "ReferidoArea" WHERE "area" = 'MEDICA';
  RAISE NOTICE 'Referencias a MEDICA que quedan pendientes de primera consulta: %', pendientes;
END
$$;
