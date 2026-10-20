-- Una audiencia "Se realizó" siempre registra lo ocurrido, igual que exige
-- `registrarResultadoAudienciaSchema` (la de "No se realizó" ya exige motivo en _motivo_chk).
-- coalesce: un CHECK que da NULL pasa.
ALTER TABLE "AudienciaJuridica"
  ADD CONSTRAINT "AudienciaJuridica_realizada_obs_chk"
    CHECK ("estado" <> 'REALIZADA' OR coalesce(length(trim("observaciones")), 0) > 0);
