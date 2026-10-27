-- Reemplaza los únicos con NULLS NOT DISTINCT de medica_citas_familiares por índices parciales:
-- Prisma no sabe declarar NULLS NOT DISTINCT y en cada `migrate dev` propondría borrarlos; los
-- índices parciales los ignora (igual que `AtencionMedica_activa_uq`). Además, en ConsultaMedica
-- el único anterior trataba como iguales dos consultas sin cita (citaId null) de la usuaria.

DROP INDEX "CitaMedicaPersona_cita_persona_uq";
-- Un hijo/a una sola vez por cita.
CREATE UNIQUE INDEX "CitaMedicaPersona_cita_nino_uq" ON "CitaMedicaPersona"("citaId", "ninoId") WHERE "ninoId" IS NOT NULL;
-- La usuaria una sola vez por cita.
CREATE UNIQUE INDEX "CitaMedicaPersona_cita_usuaria_uq" ON "CitaMedicaPersona"("citaId") WHERE "ninoId" IS NULL;

DROP INDEX "ConsultaMedica_cita_persona_uq";
-- Una consulta por persona de la cita. Las consultas sin cita (citaId null) no entran: en un
-- índice único, null nunca choca con null.
CREATE UNIQUE INDEX "ConsultaMedica_cita_nino_uq" ON "ConsultaMedica"("citaId", "ninoId") WHERE "ninoId" IS NOT NULL;
CREATE UNIQUE INDEX "ConsultaMedica_cita_usuaria_uq" ON "ConsultaMedica"("citaId") WHERE "ninoId" IS NULL;
