-- Corrige CitaPsicologica_atencion_brindada_chk: con "atencionBrindada" NULL la expresión
-- length(btrim(NULL)) > 0 da NULL y un CHECK deja pasar NULL. Ahora una sesión atendida y ya
-- registrada (no borrador) sin atención brindada se rechaza.
ALTER TABLE "CitaPsicologica" DROP CONSTRAINT "CitaPsicologica_atencion_brindada_chk";
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_atencion_brindada_chk"
  CHECK ("estado" <> 'ATENDIDA' OR "borrador" OR COALESCE(length(btrim("atencionBrindada")), 0) > 0);
