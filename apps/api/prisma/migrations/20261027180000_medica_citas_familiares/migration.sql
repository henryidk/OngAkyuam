-- Medicina: citas familiares (planfamiliamedica.md §6). Una cita atiende a la usuaria y/o a sus
-- hijos/as, cada persona con su propio registro de consulta; la duración la elige la médica
-- (30, 60 o 90 min). Borra la columna CitaMedica.ninoId (confirmado por el usuario el
-- 2026-10-27): antes de borrarla, cada cita existente pasa a una fila de CitaMedicaPersona.

-- CreateTable
CREATE TABLE "CitaMedicaPersona" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "ninoId" TEXT,

    CONSTRAINT "CitaMedicaPersona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CitaMedicaPersona_citaId_idx" ON "CitaMedicaPersona"("citaId");

-- CreateIndex
CREATE INDEX "CitaMedicaPersona_ninoId_idx" ON "CitaMedicaPersona"("ninoId");

-- AddForeignKey
ALTER TABLE "CitaMedicaPersona" ADD CONSTRAINT "CitaMedicaPersona_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "CitaMedica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaMedicaPersona" ADD CONSTRAINT "CitaMedicaPersona_ninoId_fkey" FOREIGN KEY ("ninoId") REFERENCES "Nino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Traslado: la persona de cada cita existente (ninoId null = la usuaria).
INSERT INTO "CitaMedicaPersona" ("id", "citaId", "ninoId")
SELECT gen_random_uuid()::text, "id", "ninoId" FROM "CitaMedica";

-- La usuaria (ninoId null) no puede aparecer dos veces en la misma cita.
CREATE UNIQUE INDEX "CitaMedicaPersona_cita_persona_uq" ON "CitaMedicaPersona"("citaId", "ninoId") NULLS NOT DISTINCT;

-- DropForeignKey
ALTER TABLE "CitaMedica" DROP CONSTRAINT "CitaMedica_ninoId_fkey";

-- DropIndex
DROP INDEX "CitaMedica_ninoId_idx";

-- AlterTable
ALTER TABLE "CitaMedica" DROP COLUMN "ninoId";

-- Una consulta por persona de la cita (antes, una por cita).
DROP INDEX "ConsultaMedica_citaId_key";
CREATE INDEX "ConsultaMedica_citaId_idx" ON "ConsultaMedica"("citaId");
CREATE UNIQUE INDEX "ConsultaMedica_cita_persona_uq" ON "ConsultaMedica"("citaId", "ninoId") NULLS NOT DISTINCT;

-- Duraciones permitidas: mismas que `DURACIONES_CITA_MEDICA_MIN` en packages/shared.
ALTER TABLE "CitaMedica" DROP CONSTRAINT "CitaMedica_duracion_chk";
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_duracion_chk" CHECK ("duracionMin" IN (30, 60, 90));

-- Con duraciones distintas, un único por `inicio` ya no evita traslapes (09:00 de 1 h y 09:30).
-- Se reemplaza por una exclusión sobre el rango [inicio, fin). `timestamptz + interval` es STABLE
-- (un intervalo en días depende de la zona), y un índice exige IMMUTABLE: esta función solo
-- suma minutos, que no dependen de la zona, así que declararla IMMUTABLE es correcto.
CREATE FUNCTION "medica_fin_cita"(inicio timestamptz, duracion_min integer) RETURNS timestamptz
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT inicio + make_interval(mins => duracion_min) $$;

DROP INDEX "CitaMedica_horario_uq";
ALTER TABLE "CitaMedica" ADD CONSTRAINT "CitaMedica_sin_traslape_excl"
  EXCLUDE USING gist (tstzrange("inicio", "medica_fin_cita"("inicio", "duracionMin"), '[)') WITH &&)
  WHERE ("estado" IN ('PROGRAMADA', 'ATENDIDA'));
