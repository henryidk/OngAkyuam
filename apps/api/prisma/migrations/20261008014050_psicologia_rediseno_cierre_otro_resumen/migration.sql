-- Corrige la validación de la migración anterior: con el resumen en NULL, `length(trim(NULL)) > 0`
-- da NULL y un CHECK deja pasar NULL, así que un cierre con motivo "Otro" y sin resumen no se
-- rechazaba. COALESCE lo vuelve una comparación que sí falla. No toca datos.
ALTER TABLE "AtencionPsicologica"
  DROP CONSTRAINT "AtencionPsicologica_cierre_otro_chk",
  ADD CONSTRAINT "AtencionPsicologica_cierre_otro_chk"
    CHECK ("motivoCierreCatalogo" IS DISTINCT FROM 'OTRO' OR length(trim(COALESCE("resumenCierre", ''))) > 0);
