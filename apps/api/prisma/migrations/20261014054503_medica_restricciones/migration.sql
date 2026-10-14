-- Medicina, paso 2 de 3 (restringir). Solo agrega índices y CHECK a tablas recién creadas y
-- vacías; no toca tablas de otras áreas ni borra datos. Prisma no sabe declarar nada de esto.

-- Una sola atención ACTIVA por expediente. También resuelve la carrera de dos pestañas abriendo
-- la primera consulta a la vez: la segunda inserción falla.
CREATE UNIQUE INDEX "AtencionMedica_activa_uq" ON "AtencionMedica"("expedienteId") WHERE "estado" = 'ACTIVA';

-- Un horario solo admite una cita vigente. Una NO_ASISTIO o CANCELADA libera el horario.
CREATE UNIQUE INDEX "CitaMedica_horario_uq" ON "CitaMedica"("inicio") WHERE "estado" IN ('PROGRAMADA', 'ATENDIDA');

ALTER TABLE "AtencionMedica"
  ADD CONSTRAINT "AtencionMedica_consecutivo_chk" CHECK ("consecutivo" >= 1),
  -- ALTA si y solo si tiene fecha y motivo de alta.
  ADD CONSTRAINT "AtencionMedica_alta_chk"
    CHECK (("estado" = 'ALTA') = ("fechaAlta" IS NOT NULL AND "motivoAlta" IS NOT NULL)),
  -- El motivo "Otro" exige nota. `coalesce` porque un CHECK que evalúa a NULL se da por bueno.
  ADD CONSTRAINT "AtencionMedica_otro_chk"
    CHECK ("motivoAlta" IS DISTINCT FROM 'OTRO' OR coalesce(length(trim("notaAlta")), 0) > 0);

ALTER TABLE "CitaMedica"
  ADD CONSTRAINT "CitaMedica_duracion_chk" CHECK ("duracionMin" BETWEEN 10 AND 120),
  ADD CONSTRAINT "CitaMedica_no_autorreprog_chk" CHECK ("reprogramadaDesdeId" IS DISTINCT FROM "id");

-- Mismos rangos que `RANGOS_SIGNOS_VITALES` en packages/shared/src/catalogos/medica.ts (una
-- prueba del backend los compara). Son límites de captura, no rangos clínicos.
ALTER TABLE "ConsultaMedica"
  ADD CONSTRAINT "ConsultaMedica_rangos_chk" CHECK (
        ("presionSistolica"   IS NULL OR "presionSistolica"   BETWEEN 50 AND 260)
    AND ("presionDiastolica"  IS NULL OR "presionDiastolica"  BETWEEN 30 AND 160)
    AND ("frecuenciaCardiaca" IS NULL OR "frecuenciaCardiaca" BETWEEN 20 AND 250)
    AND ("frecuenciaResp"     IS NULL OR "frecuenciaResp"     BETWEEN 4 AND 80)
    AND ("temperaturaC"       IS NULL OR "temperaturaC"       BETWEEN 30 AND 45)
    AND ("saturacionO2"       IS NULL OR "saturacionO2"       BETWEEN 50 AND 100)
    AND ("glucosaMgDl"        IS NULL OR "glucosaMgDl"        BETWEEN 10 AND 900)
    AND ("pesoKg"             IS NULL OR "pesoKg"             BETWEEN 0.5 AND 400)
    AND ("tallaM"             IS NULL OR "tallaM"             BETWEEN 0.3 AND 2.5)
    -- La presión se registra completa o no se registra.
    AND (("presionSistolica" IS NULL) = ("presionDiastolica" IS NULL))
  ),
  ADD CONSTRAINT "ConsultaMedica_dx_chk" CHECK (length(trim("diagnostico")) > 0);
