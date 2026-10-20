-- CreateEnum
CREATE TYPE "EstadoAudiencia" AS ENUM ('PROGRAMADA', 'REALIZADA', 'NO_REALIZADA', 'CANCELADA', 'REPROGRAMADA');

-- CreateEnum
CREATE TYPE "OrigenCancelacionAudiencia" AS ENUM ('MANUAL', 'PROCESO_FINALIZADO', 'PROCESO_ABANDONADO');

-- AlterTable
ALTER TABLE "DocumentoProceso" ADD COLUMN     "audienciaId" TEXT;

-- CreateTable
CREATE TABLE "AudienciaJuridica" (
    "id" TEXT NOT NULL,
    "procesoId" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "responsableId" TEXT NOT NULL,
    "estado" "EstadoAudiencia" NOT NULL DEFAULT 'PROGRAMADA',
    "descripcion" VARCHAR(80),
    "observaciones" TEXT,
    "motivo" VARCHAR(300),
    "origenCancelacion" "OrigenCancelacionAudiencia",
    "reprogramadaDesdeId" TEXT,
    "resultadoEn" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AudienciaJuridica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AudienciaJuridica_reprogramadaDesdeId_key" ON "AudienciaJuridica"("reprogramadaDesdeId");

-- CreateIndex
CREATE INDEX "AudienciaJuridica_procesoId_inicio_idx" ON "AudienciaJuridica"("procesoId", "inicio");

-- CreateIndex
CREATE INDEX "AudienciaJuridica_responsableId_inicio_idx" ON "AudienciaJuridica"("responsableId", "inicio");

-- CreateIndex
CREATE INDEX "AudienciaJuridica_inicio_idx" ON "AudienciaJuridica"("inicio");

-- CreateIndex
CREATE INDEX "DocumentoProceso_audienciaId_idx" ON "DocumentoProceso"("audienciaId");

-- AddForeignKey
ALTER TABLE "DocumentoProceso" ADD CONSTRAINT "DocumentoProceso_audienciaId_fkey" FOREIGN KEY ("audienciaId") REFERENCES "AudienciaJuridica"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaJuridica" ADD CONSTRAINT "AudienciaJuridica_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaJuridica" ADD CONSTRAINT "AudienciaJuridica_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaJuridica" ADD CONSTRAINT "AudienciaJuridica_reprogramadaDesdeId_fkey" FOREIGN KEY ("reprogramadaDesdeId") REFERENCES "AudienciaJuridica"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaJuridica" ADD CONSTRAINT "AudienciaJuridica_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---- Restricciones que Prisma no sabe declarar (planaudiencias.md §6.2) ----

-- Una abogada no puede tener dos audiencias PROGRAMADAS en el mismo instante. Índice único
-- parcial (mismo patrón que medica_restricciones): las canceladas, reprogramadas y con
-- resultado no cuentan, así que liberan su hora. Es la red de seguridad contra dos operadoras
-- que agendan a la vez: el servicio valida antes para dar un mensaje amable.
CREATE UNIQUE INDEX "AudienciaJuridica_responsable_inicio_programada_key"
  ON "AudienciaJuridica" ("responsableId", "inicio")
  WHERE ("estado" = 'PROGRAMADA');

ALTER TABLE "AudienciaJuridica"
  -- Hora en minutos exactos: sin segundos ni milisegundos, así "la misma hora" no se esquiva
  -- con 09:30:00 contra 09:30:01.
  ADD CONSTRAINT "AudienciaJuridica_minuto_exacto_chk"
    CHECK ("inicio" = date_trunc('minute', "inicio")),
  -- Una audiencia no puede ser la reprogramación de sí misma.
  ADD CONSTRAINT "AudienciaJuridica_no_autorreprog_chk"
    CHECK ("reprogramadaDesdeId" IS DISTINCT FROM "id"),
  -- Cancelar, no realizar o reprogramar exige motivo (coalesce: un CHECK que da NULL pasa).
  ADD CONSTRAINT "AudienciaJuridica_motivo_chk"
    CHECK ("estado" NOT IN ('CANCELADA', 'NO_REALIZADA', 'REPROGRAMADA')
           OR coalesce(length(trim("motivo")), 0) > 0),
  -- CANCELADA si y solo si tiene origen de cancelación.
  ADD CONSTRAINT "AudienciaJuridica_origen_chk"
    CHECK (("estado" = 'CANCELADA') = ("origenCancelacion" IS NOT NULL)),
  -- Un resultado siempre tiene su instante de registro, y solo un resultado lo tiene.
  ADD CONSTRAINT "AudienciaJuridica_resultado_chk"
    CHECK (("estado" IN ('REALIZADA', 'NO_REALIZADA')) = ("resultadoEn" IS NOT NULL));
