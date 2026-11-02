-- Campos nuevos del reporte "Población beneficiada" de Trabajo Social: sede del personal,
-- área urbana/rural y ocupación de la usuaria, condición de maternidad e idioma de atención
-- del caso, bitácora de atención brindada por Trabajo Social y atención brindada en cada
-- sesión de Psicología y consulta de Medicina. El grupo étnico pasa a Maya / Xinca / Garífuna /
-- Ladino / Otro.
--
-- Todas las columnas nuevas son NOT NULL. Las filas que ya existían (al 2026-11-02 solo hay
-- datos de desarrollo) se rellenan con un valor antes de exigirlo; en una base vacía estos
-- UPDATE no tocan nada.

-- CreateEnum
CREATE TYPE "Sede" AS ENUM ('COBAN', 'TACTIC');

-- CreateEnum
CREATE TYPE "AreaResidencia" AS ENUM ('URBANA', 'RURAL');

-- CreateEnum
CREATE TYPE "CondicionMaternidad" AS ENUM ('GESTANTE', 'LACTANTE', 'NORMAL');

-- CreateEnum
CREATE TYPE "IdiomaAtencion" AS ENUM ('ESPANOL', 'QEQCHI', 'POQOMCHI', 'OTRO');

-- AlterEnum: Maya Q'eqchi' y Maya Poqomchi' se registran ahora como Maya.
CREATE TYPE "GrupoEtnico_new" AS ENUM ('MAYA', 'XINCA', 'GARIFUNA', 'LADINO', 'OTRO');
ALTER TABLE "Usuaria" ALTER COLUMN "grupoEtnico" TYPE "GrupoEtnico_new" USING (
  CASE "grupoEtnico"::text
    WHEN 'MAYA_QECHI' THEN 'MAYA'
    WHEN 'MAYA_POQOMCHI' THEN 'MAYA'
    ELSE "grupoEtnico"::text
  END::"GrupoEtnico_new"
);
ALTER TYPE "GrupoEtnico" RENAME TO "GrupoEtnico_old";
ALTER TYPE "GrupoEtnico_new" RENAME TO "GrupoEtnico";
DROP TYPE "public"."GrupoEtnico_old";

-- AlterTable: CitaPsicologica. Una sesión atendida y ya registrada (no borrador) siempre dice
-- qué atención se brindó.
ALTER TABLE "CitaPsicologica" ADD COLUMN "atencionBrindada" VARCHAR(300);
UPDATE "CitaPsicologica"
SET "atencionBrindada" = 'Atención psicológica'
WHERE "estado" = 'ATENDIDA' AND NOT "borrador";
ALTER TABLE "CitaPsicologica" ADD CONSTRAINT "CitaPsicologica_atencion_brindada_chk"
  CHECK ("estado" <> 'ATENDIDA' OR "borrador" OR length(btrim("atencionBrindada")) > 0);

-- AlterTable: ConsultaMedica
ALTER TABLE "ConsultaMedica" ADD COLUMN "atencionBrindada" VARCHAR(300);
UPDATE "ConsultaMedica" SET "atencionBrindada" = 'Consulta médica';
ALTER TABLE "ConsultaMedica" ALTER COLUMN "atencionBrindada" SET NOT NULL;

-- AlterTable: Expediente
ALTER TABLE "Expediente" ADD COLUMN "condicionMaternidad" "CondicionMaternidad",
ADD COLUMN "idiomaAtencion" "IdiomaAtencion";
UPDATE "Expediente" SET "condicionMaternidad" = 'NORMAL', "idiomaAtencion" = 'ESPANOL';
ALTER TABLE "Expediente" ALTER COLUMN "condicionMaternidad" SET NOT NULL,
ALTER COLUMN "idiomaAtencion" SET NOT NULL;

-- AlterTable: Usuaria
ALTER TABLE "Usuaria" ADD COLUMN "areaResidencia" "AreaResidencia",
ADD COLUMN "ocupacion" VARCHAR(120);
UPDATE "Usuaria" SET "areaResidencia" = 'URBANA', "ocupacion" = 'No registrada';
ALTER TABLE "Usuaria" ALTER COLUMN "areaResidencia" SET NOT NULL,
ALTER COLUMN "ocupacion" SET NOT NULL;

-- AlterTable: Usuario
ALTER TABLE "Usuario" ADD COLUMN "sede" "Sede";
UPDATE "Usuario" SET "sede" = 'COBAN';
ALTER TABLE "Usuario" ALTER COLUMN "sede" SET NOT NULL;

-- CreateTable
CREATE TABLE "AccionTrabajoSocial" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "registradaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccionTrabajoSocial_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccionTrabajoSocial_descripcion_chk" CHECK (length(btrim("descripcion")) > 0)
);

-- CreateIndex
CREATE INDEX "AccionTrabajoSocial_expedienteId_fecha_idx" ON "AccionTrabajoSocial"("expedienteId", "fecha");

-- AddForeignKey
ALTER TABLE "AccionTrabajoSocial" ADD CONSTRAINT "AccionTrabajoSocial_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccionTrabajoSocial" ADD CONSTRAINT "AccionTrabajoSocial_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
