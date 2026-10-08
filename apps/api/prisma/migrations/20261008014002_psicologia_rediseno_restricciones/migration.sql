-- Rediseño de Psicología, paso 3 de 4 (restringir). No borra datos.
--
-- Hasta ahora un expediente tenía una sola atención psicológica. Con el rediseño puede tener
-- varios procesos (P1, P2, …) cuando la usuaria regresa, así que la unicidad por expediente se
-- reemplaza por: consecutivo único por expediente + a lo más un proceso sin cerrar a la vez.

-- DropIndex
DROP INDEX "AtencionPsicologica_expedienteId_key";

-- CreateIndex
CREATE UNIQUE INDEX "AtencionPsicologica_expedienteId_consecutivo_key" ON "AtencionPsicologica"("expedienteId", "consecutivo");

-- Índice parcial (Prisma no lo modela): un solo proceso sin cerrar por expediente. También es lo
-- que resuelve la carrera de dos psicólogas tomando el mismo caso: la segunda inserción falla.
CREATE UNIQUE INDEX "AtencionPsicologica_activa_uq" ON "AtencionPsicologica"("expedienteId") WHERE "estado" <> 'CIERRE';

ALTER TABLE "AtencionPsicologica"
  ADD CONSTRAINT "AtencionPsicologica_consecutivo_chk" CHECK ("consecutivo" >= 1),
  -- Un proceso cerrado siempre tiene fecha y motivo de cierre.
  ADD CONSTRAINT "AtencionPsicologica_cierre_chk"
    CHECK ("estado" <> 'CIERRE' OR ("fechaCierre" IS NOT NULL AND "motivoCierreCatalogo" IS NOT NULL)),
  -- El motivo "Otro" exige explicarlo.
  ADD CONSTRAINT "AtencionPsicologica_cierre_otro_chk"
    CHECK ("motivoCierreCatalogo" IS DISTINCT FROM 'OTRO' OR length(trim("resumenCierre")) > 0);
