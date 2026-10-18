BEGIN;
ALTER TABLE "Nino" ADD COLUMN "consecutivo" INTEGER NOT NULL DEFAULT 0;
WITH orden AS (SELECT id, row_number() OVER (PARTITION BY "expedienteId" ORDER BY "fechaNacimiento", id)::int AS n FROM "Nino")
UPDATE "Nino" h SET consecutivo=orden.n FROM orden WHERE h.id=orden.id;
CREATE UNIQUE INDEX "Nino_expedienteId_consecutivo_key" ON "Nino"("expedienteId",consecutivo);
ALTER TABLE "Nino" ADD CONSTRAINT "Nino_consecutivo_positivo" CHECK (consecutivo > 0);
CREATE FUNCTION asignar_consecutivo_hijo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Expediente" WHERE id=NEW."expedienteId" FOR UPDATE;
  IF NEW.consecutivo=0 THEN SELECT coalesce(max(consecutivo),0)+1 INTO NEW.consecutivo FROM "Nino" WHERE "expedienteId"=NEW."expedienteId"; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Nino_asignar_consecutivo" BEFORE INSERT ON "Nino" FOR EACH ROW EXECUTE FUNCTION asignar_consecutivo_hijo();

ALTER TABLE "AtencionPsicologica" ADD COLUMN "ninoId" TEXT;
ALTER TABLE "AtencionPsicologica" ADD CONSTRAINT "AtencionPsicologica_ninoId_fkey" FOREIGN KEY ("ninoId") REFERENCES "Nino"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CitaPsicologica" ADD COLUMN "enfoqueTerapeutico" TEXT;
DROP INDEX "AtencionPsicologica_activa_uq";

-- Separate existing child sessions while preserving clinical records and their documents.
DO $$ DECLARE r record; anterior "AtencionPsicologica"%ROWTYPE; nuevo text; siguiente integer;
BEGIN
 FOR r IN SELECT DISTINCT "atencionId", "ninoId" FROM "CitaPsicologica" WHERE "ninoId" IS NOT NULL LOOP
  SELECT * INTO anterior FROM "AtencionPsicologica" WHERE id=r."atencionId";
  nuevo := md5('psicologia-persona:' || anterior.id || ':' || r."ninoId")::uuid::text;
  SELECT coalesce(max(consecutivo),0)+1 INTO siguiente FROM "AtencionPsicologica" WHERE "expedienteId"=anterior."expedienteId";
  INSERT INTO "AtencionPsicologica" (id,"expedienteId","ninoId",estado,"psicologaAsignadaId","tomadaEn","fechaInicio","fechaCierre",consecutivo,"motivoCierreCatalogo","resumenCierre","visibleJuridico","visibleMedica","referidoId",version,"actualizadoPorId","createdAt","updatedAt")
  VALUES (nuevo,anterior."expedienteId",r."ninoId",anterior.estado,anterior."psicologaAsignadaId",anterior."tomadaEn",anterior."fechaInicio",anterior."fechaCierre",siguiente,anterior."motivoCierreCatalogo",anterior."resumenCierre",anterior."visibleJuridico",anterior."visibleMedica",anterior."referidoId",anterior.version,anterior."actualizadoPorId",anterior."createdAt",anterior."updatedAt");
  UPDATE "CitaPsicologica" SET "atencionId"=nuevo WHERE "atencionId"=anterior.id AND "ninoId"=r."ninoId";
  INSERT INTO "CambioEstadoAtencion" (id,"atencionId","estadoAnterior","estadoNuevo",motivo,"registradoPorId","createdAt") SELECT md5(id || ':' || nuevo)::uuid::text,nuevo,"estadoAnterior","estadoNuevo",motivo,"registradoPorId","createdAt" FROM "CambioEstadoAtencion" WHERE "atencionId"=anterior.id;
 END LOOP;
END $$;
CREATE UNIQUE INDEX "AtencionPsicologica_madre_activa_uq" ON "AtencionPsicologica"("expedienteId") WHERE estado <> 'CIERRE' AND "ninoId" IS NULL;
CREATE UNIQUE INDEX "AtencionPsicologica_hijo_activo_uq" ON "AtencionPsicologica"("ninoId") WHERE estado <> 'CIERRE' AND "ninoId" IS NOT NULL;
CREATE FUNCTION validar_persona_proceso_psicologia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."ninoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Nino" WHERE id=NEW."ninoId" AND "expedienteId"=NEW."expedienteId") THEN RAISE EXCEPTION 'El hijo no pertenece al expediente de la madre'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AtencionPsicologica_validar_persona" BEFORE INSERT OR UPDATE OF "ninoId","expedienteId" ON "AtencionPsicologica" FOR EACH ROW EXECUTE FUNCTION validar_persona_proceso_psicologia();
CREATE FUNCTION validar_persona_cita_psicologia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "AtencionPsicologica" WHERE id=NEW."atencionId" AND "ninoId" IS NOT DISTINCT FROM NEW."ninoId") THEN RAISE EXCEPTION 'La cita debe corresponder a la persona del proceso'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CitaPsicologica_validar_persona" BEFORE INSERT OR UPDATE OF "atencionId","ninoId" ON "CitaPsicologica" FOR EACH ROW EXECUTE FUNCTION validar_persona_cita_psicologia();
COMMIT;
