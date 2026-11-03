-- Integridad de los datos compartidos entre áreas (etapa 4 del plan).
--
-- Cada restricción revisa primero los datos existentes y aborta con un mensaje claro si alguno
-- no cumple, en vez de dejar que el ALTER falle con un error genérico.
--
-- Fuera de esta migración, a propósito: un índice único del No. judicial. Jurídico deja
-- guardar un número repetido cuando la abogada lo confirma (`confirmarNumeroRepetido`), así
-- que la base no puede prohibirlo.

-- 1. Verificación previa ---------------------------------------------------------------------
DO $$
DECLARE
  v INT;
BEGIN
  SELECT count(*) INTO v FROM "Expediente" WHERE "numero" !~ '^[0-9]{2,}-[0-9]{4}$';
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % expedientes con un número fuera del formato NN-AAAA', v;
  END IF;

  SELECT count(*) INTO v FROM "ExpedienteContador" WHERE "ultimo" < 0;
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % contadores de expediente negativos', v;
  END IF;

  SELECT count(*) INTO v FROM "Personal" WHERE btrim("tipo") = '';
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % fichas de personal sin cargo', v;
  END IF;

  SELECT count(*) INTO v FROM "AtencionPsicologica"
  WHERE ("estado" = 'CIERRE') <> ("fechaCierre" IS NOT NULL AND "motivoCierreCatalogo" IS NOT NULL);
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % procesos de psicología con datos de cierre que no corresponden a su estado', v;
  END IF;

  SELECT count(*) INTO v FROM "ProcesoJuridico" p JOIN "Personal" f ON f."id" = p."abogadaId"
  WHERE NOT (f."area" = 'JURIDICO' AND f."tipo" = 'ABOGADA');
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % procesos jurídicos cuya abogada no es una abogada de Jurídico', v;
  END IF;

  SELECT count(*) INTO v FROM "ProcesoJuridico" p JOIN "Personal" f ON f."id" = p."procuradoraId"
  WHERE NOT (f."area" = 'JURIDICO' AND f."tipo" = 'PROCURADORA');
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % procesos jurídicos cuya procuradora no es una procuradora de Jurídico', v;
  END IF;

  SELECT count(*) INTO v FROM "AudienciaJuridica" a JOIN "Personal" f ON f."id" = a."responsableId"
  WHERE NOT (f."area" = 'JURIDICO' AND f."tipo" IN ('ABOGADA', 'PROCURADORA'));
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % audiencias cuya responsable no es abogada ni procuradora de Jurídico', v;
  END IF;

  SELECT count(*) INTO v FROM "AtencionPsicologica" a JOIN "Usuario" u ON u."id" = a."psicologaAsignadaId"
  WHERE u."rol" <> 'PSICOLOGIA';
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % procesos de psicología asignados a una cuenta que no es de Psicología', v;
  END IF;

  SELECT count(*) INTO v FROM "AtencionMedica" a JOIN "Usuario" u ON u."id" = a."medicaId"
  WHERE u."rol" <> 'MEDICA';
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % atenciones médicas asignadas a una cuenta que no es de Médica', v;
  END IF;

  SELECT count(*) INTO v FROM "Personal" f JOIN "Usuario" u ON u."id" = f."usuarioId"
  WHERE f."area" <> u."rol";
  IF v > 0 THEN
    RAISE EXCEPTION 'Hay % fichas de personal enlazadas a una cuenta de otra área', v;
  END IF;
END;
$$;

-- 2. Formatos y valores ---------------------------------------------------------------------
ALTER TABLE "Expediente"
  ADD CONSTRAINT "Expediente_numero_formato_chk" CHECK ("numero" ~ '^[0-9]{2,}-[0-9]{4}$');

ALTER TABLE "ExpedienteContador"
  ADD CONSTRAINT "ExpedienteContador_ultimo_chk" CHECK ("ultimo" >= 0);

ALTER TABLE "Personal"
  ADD CONSTRAINT "Personal_tipo_chk" CHECK (btrim("tipo") <> '');

-- Igual que Jurídico y Médica: cerrado si y solo si tiene fecha y motivo de cierre. Reemplaza
-- al CHECK anterior, que solo pedía los datos en un cierre pero dejaba un proceso abierto con
-- fecha de cierre.
ALTER TABLE "AtencionPsicologica"
  DROP CONSTRAINT "AtencionPsicologica_cierre_chk",
  ADD CONSTRAINT "AtencionPsicologica_cierre_chk"
    CHECK (("estado" = 'CIERRE') = ("fechaCierre" IS NOT NULL AND "motivoCierreCatalogo" IS NOT NULL));

-- 3. Quién puede quedar asignado ------------------------------------------------------------
-- La API ya lo valida con un mensaje claro por campo; estos triggers son el respaldo para
-- cualquier otra vía (seeds, SQL a mano). Solo revisan al insertar o al cambiar la columna,
-- así una ficha desactivada después no bloquea el historial.

CREATE FUNCTION "proceso_juridico_personal_chk"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."abogadaId" IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW."abogadaId" IS DISTINCT FROM OLD."abogadaId")
     AND NOT EXISTS (
       SELECT 1 FROM "Personal" f
       WHERE f."id" = NEW."abogadaId" AND f."area" = 'JURIDICO' AND f."tipo" = 'ABOGADA'
     ) THEN
    RAISE EXCEPTION 'La abogada del proceso debe ser una abogada de Jurídico'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."procuradoraId" IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW."procuradoraId" IS DISTINCT FROM OLD."procuradoraId")
     AND NOT EXISTS (
       SELECT 1 FROM "Personal" f
       WHERE f."id" = NEW."procuradoraId" AND f."area" = 'JURIDICO' AND f."tipo" = 'PROCURADORA'
     ) THEN
    RAISE EXCEPTION 'La procuradora del proceso debe ser una procuradora de Jurídico'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProcesoJuridico_personal_chk"
  BEFORE INSERT OR UPDATE OF "abogadaId", "procuradoraId" ON "ProcesoJuridico"
  FOR EACH ROW EXECUTE FUNCTION "proceso_juridico_personal_chk"();

CREATE FUNCTION "audiencia_juridica_responsable_chk"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW."responsableId" IS DISTINCT FROM OLD."responsableId")
     AND NOT EXISTS (
       SELECT 1 FROM "Personal" f
       WHERE f."id" = NEW."responsableId" AND f."area" = 'JURIDICO'
         AND f."tipo" IN ('ABOGADA', 'PROCURADORA')
     ) THEN
    RAISE EXCEPTION 'La responsable de la audiencia debe ser abogada o procuradora de Jurídico'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AudienciaJuridica_responsable_chk"
  BEFORE INSERT OR UPDATE OF "responsableId" ON "AudienciaJuridica"
  FOR EACH ROW EXECUTE FUNCTION "audiencia_juridica_responsable_chk"();

CREATE FUNCTION "atencion_psicologica_psicologa_chk"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."psicologaAsignadaId" IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW."psicologaAsignadaId" IS DISTINCT FROM OLD."psicologaAsignadaId")
     AND NOT EXISTS (
       SELECT 1 FROM "Usuario" u WHERE u."id" = NEW."psicologaAsignadaId" AND u."rol" = 'PSICOLOGIA'
     ) THEN
    RAISE EXCEPTION 'El proceso solo se asigna a una cuenta de Psicología'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AtencionPsicologica_psicologa_chk"
  BEFORE INSERT OR UPDATE OF "psicologaAsignadaId" ON "AtencionPsicologica"
  FOR EACH ROW EXECUTE FUNCTION "atencion_psicologica_psicologa_chk"();

CREATE FUNCTION "atencion_medica_medica_chk"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."medicaId" IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW."medicaId" IS DISTINCT FROM OLD."medicaId")
     AND NOT EXISTS (
       SELECT 1 FROM "Usuario" u WHERE u."id" = NEW."medicaId" AND u."rol" = 'MEDICA'
     ) THEN
    RAISE EXCEPTION 'La atención médica solo se asigna a una cuenta de Médica'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AtencionMedica_medica_chk"
  BEFORE INSERT OR UPDATE OF "medicaId" ON "AtencionMedica"
  FOR EACH ROW EXECUTE FUNCTION "atencion_medica_medica_chk"();

-- 4. Cuenta ↔ ficha de personal: si la ficha está enlazada, la cuenta manda -----------------
-- Al enlazar (al crear la ficha con cuenta o al conectarla después) la ficha toma el nombre y
-- el estado de la cuenta. Mientras siga enlazada, no se cambian por su cuenta: se cambian desde
-- la cuenta, y el trigger de "Usuario" los copia.

CREATE FUNCTION "personal_sincronizado"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_cuenta RECORD;
BEGIN
  IF NEW."usuarioId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "nombreCompleto", "isActive", "rol" INTO v_cuenta
  FROM "Usuario" WHERE "id" = NEW."usuarioId";
  IF NOT FOUND THEN
    -- La llave foránea da el error propio.
    RETURN NEW;
  END IF;

  IF NEW."area" <> v_cuenta."rol" THEN
    RAISE EXCEPTION 'La ficha de personal es de otra área que la cuenta'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' OR NEW."usuarioId" IS DISTINCT FROM OLD."usuarioId" THEN
    NEW."nombre" := v_cuenta."nombreCompleto";
    NEW."activo" := v_cuenta."isActive";
  ELSIF NEW."nombre" IS DISTINCT FROM v_cuenta."nombreCompleto"
        OR NEW."activo" IS DISTINCT FROM v_cuenta."isActive" THEN
    RAISE EXCEPTION 'La ficha está enlazada a una cuenta: su nombre y estado se cambian desde la cuenta'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Personal_sincronizado"
  BEFORE INSERT OR UPDATE ON "Personal"
  FOR EACH ROW EXECUTE FUNCTION "personal_sincronizado"();

CREATE FUNCTION "usuario_sincroniza_personal"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Personal"
  SET "nombre" = NEW."nombreCompleto", "activo" = NEW."isActive", "updatedAt" = now()
  WHERE "usuarioId" = NEW."id"
    AND ("nombre" IS DISTINCT FROM NEW."nombreCompleto" OR "activo" IS DISTINCT FROM NEW."isActive");
  RETURN NULL;
END;
$$;

CREATE TRIGGER "Usuario_sincroniza_personal"
  AFTER UPDATE OF "nombreCompleto", "isActive" ON "Usuario"
  FOR EACH ROW EXECUTE FUNCTION "usuario_sincroniza_personal"();

-- Alinea las fichas ya enlazadas (en desarrollo, hoy ninguna difiere).
DO $$
DECLARE
  v INT;
BEGIN
  UPDATE "Personal" f
  SET "nombre" = u."nombreCompleto", "activo" = u."isActive", "updatedAt" = now()
  FROM "Usuario" u
  WHERE u."id" = f."usuarioId"
    AND (f."nombre" IS DISTINCT FROM u."nombreCompleto" OR f."activo" IS DISTINCT FROM u."isActive");
  GET DIAGNOSTICS v = ROW_COUNT;
  RAISE NOTICE 'Personal: % fichas enlazadas alineadas con su cuenta', v;
END;
$$;
