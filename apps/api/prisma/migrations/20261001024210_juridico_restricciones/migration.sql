-- DropIndex
DROP INDEX "AbandonoProceso_procesoId_key";

-- DropIndex
DROP INDEX "ProcesoJuridico_expedienteId_idx";

-- AlterTable
ALTER TABLE "AbandonoProceso" ALTER COLUMN "motivoCatalogo" SET NOT NULL;

-- AlterTable
ALTER TABLE "DocumentoProceso" ALTER COLUMN "carpetaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProcesoJuridico" ALTER COLUMN "consecutivo" SET NOT NULL,
ALTER COLUMN "fase" SET NOT NULL,
ALTER COLUMN "fase" SET DEFAULT 'INICIADO',
ALTER COLUMN "situacion" SET NOT NULL,
ALTER COLUMN "situacion" SET DEFAULT 'ACTIVO',
ALTER COLUMN "ultimaActuacionEn" SET NOT NULL,
ALTER COLUMN "ultimaActuacionEn" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AbandonoProceso_procesoId_idx" ON "AbandonoProceso"("procesoId");

-- CreateIndex
CREATE INDEX "ProcesoJuridico_fase_situacion_idx" ON "ProcesoJuridico"("fase", "situacion");

-- CreateIndex
CREATE INDEX "ProcesoJuridico_formaFinalizacion_idx" ON "ProcesoJuridico"("formaFinalizacion");

-- CreateIndex
CREATE INDEX "ProcesoJuridico_ultimaActuacionEn_idx" ON "ProcesoJuridico"("ultimaActuacionEn");

-- CreateIndex
CREATE UNIQUE INDEX "ProcesoJuridico_expedienteId_consecutivo_key" ON "ProcesoJuridico"("expedienteId", "consecutivo");


-- ── Restricciones que Prisma no expresa (escritas a mano) ────────────────────────────────

ALTER TABLE "ProcesoJuridico"
  -- Un proceso finalizado no puede estar suspendido ni abandonado.
  ADD CONSTRAINT "ProcesoJuridico_finalizado_activo_chk"
    CHECK ("fase" <> 'FINALIZADO' OR "situacion" = 'ACTIVO'),
  -- Forma de finalización y fecha de cierre: existen si y solo si el proceso finalizó.
  ADD CONSTRAINT "ProcesoJuridico_forma_chk"
    CHECK (("fase" = 'FINALIZADO') = ("formaFinalizacion" IS NOT NULL)),
  ADD CONSTRAINT "ProcesoJuridico_otros_detalle_chk"
    CHECK ("formaFinalizacion" <> 'OTROS' OR length(trim("detalleFinalizacion")) > 0),
  ADD CONSTRAINT "ProcesoJuridico_cierre_chk"
    CHECK (("fase" = 'FINALIZADO') = ("fechaCierre" IS NOT NULL)),
  ADD CONSTRAINT "ProcesoJuridico_no_autovinculo_chk"
    CHECK ("procesoOrigenId" IS NULL OR "procesoOrigenId" <> "id"),
  ADD CONSTRAINT "ProcesoJuridico_consecutivo_chk" CHECK ("consecutivo" >= 1);

-- Solo un abandono y una suspensión vigentes por proceso
CREATE UNIQUE INDEX "AbandonoProceso_vigente_uq"   ON "AbandonoProceso"("procesoId")   WHERE "reactivadoEn" IS NULL;
CREATE UNIQUE INDEX "SuspensionProceso_vigente_uq" ON "SuspensionProceso"("procesoId") WHERE "hasta" IS NULL;

ALTER TABLE "AbandonoProceso"
  ADD CONSTRAINT "AbandonoProceso_intentos_chk" CHECK ("intentosContacto" BETWEEN 0 AND 100);
