-- Ingreso por área: si una persona llega por primera vez en su vida a Jurídico, Psicología o
-- Médica (PRIMER_INGRESO) o si vuelve (SEGUIMIENTO). La unidad es la referencia: una fila por
-- persona y referencia (la usuaria, más cada hijo/a que el área atienda en esa referencia).
--
-- Solo la escribe la base, con los triggers de abajo: así la cubren la app, los seeds y las
-- pruebas por igual, y no hay una segunda fuente que se pueda desincronizar.
--   * Usuaria: al crearse la referencia (ReferidoArea).
--   * Hijo/a en Psicología: al fijarse el hijo/a de un proceso (AtencionPsicologica.hijoId).
--   * Hijo/a en Médica: en su primera cita o consulta dentro de la referencia.
-- Jurídico no atiende hijos/as.

-- CreateEnum
CREATE TYPE "TipoIngresoArea" AS ENUM ('PRIMER_INGRESO', 'SEGUIMIENTO');

-- CreateTable
CREATE TABLE "IngresoArea" (
    "id" TEXT NOT NULL,
    "referidoId" TEXT NOT NULL,
    "area" "Rol" NOT NULL,
    "usuariaId" TEXT NOT NULL,
    "hijoId" TEXT,
    "ingreso" "TipoIngresoArea" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngresoArea_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IngresoArea_area_chk" CHECK ("area" IN ('JURIDICO', 'PSICOLOGIA', 'MEDICA')),
    CONSTRAINT "IngresoArea_hijo_area_chk" CHECK ("hijoId" IS NULL OR "area" IN ('PSICOLOGIA', 'MEDICA'))
);

-- CreateIndex
CREATE INDEX "IngresoArea_usuariaId_area_idx" ON "IngresoArea"("usuariaId", "area");

-- CreateIndex
CREATE INDEX "IngresoArea_hijoId_area_idx" ON "IngresoArea"("hijoId", "area");

-- AddForeignKey
ALTER TABLE "IngresoArea" ADD CONSTRAINT "IngresoArea_referidoId_fkey" FOREIGN KEY ("referidoId") REFERENCES "ReferidoArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoArea" ADD CONSTRAINT "IngresoArea_usuariaId_fkey" FOREIGN KEY ("usuariaId") REFERENCES "Usuaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoArea" ADD CONSTRAINT "IngresoArea_hijoId_fkey" FOREIGN KEY ("hijoId") REFERENCES "HijoUsuaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una fila por persona y referencia (Prisma no maneja índices parciales: viven solo aquí).
CREATE UNIQUE INDEX "IngresoArea_referido_usuaria_uq" ON "IngresoArea"("referidoId") WHERE "hijoId" IS NULL;
CREATE UNIQUE INDEX "IngresoArea_referido_hijo_uq" ON "IngresoArea"("referidoId", "hijoId") WHERE "hijoId" IS NOT NULL;

-- Primer ingreso una sola vez en la vida, por persona y área.
CREATE UNIQUE INDEX "IngresoArea_primer_usuaria_uq" ON "IngresoArea"("usuariaId", "area") WHERE "hijoId" IS NULL AND "ingreso" = 'PRIMER_INGRESO';
CREATE UNIQUE INDEX "IngresoArea_primer_hijo_uq" ON "IngresoArea"("hijoId", "area") WHERE "hijoId" IS NOT NULL AND "ingreso" = 'PRIMER_INGRESO';

-- Coherencia: el área es la de la referencia, la usuaria es la del expediente de la referencia y
-- el hijo/a es de esa usuaria. Las filas no se editan: el ingreso es un hecho histórico.
CREATE FUNCTION ingreso_area_coherente() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_area "Rol";
  v_usuaria TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'El ingreso por área no se modifica'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT r."area", e."usuariaId" INTO v_area, v_usuaria
  FROM "ReferidoArea" r
  JOIN "Expediente" e ON e."id" = r."expedienteId"
  WHERE r."id" = NEW."referidoId";

  IF NOT FOUND OR NEW."area" <> v_area OR NEW."usuariaId" <> v_usuaria THEN
    RAISE EXCEPTION 'El ingreso no coincide con el área o la usuaria de su referencia'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."hijoId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "HijoUsuaria" h WHERE h."id" = NEW."hijoId" AND h."usuariaId" = v_usuaria
  ) THEN
    RAISE EXCEPTION 'El hijo/a del ingreso no es de la usuaria de la referencia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IngresoArea_coherente"
BEFORE INSERT OR UPDATE ON "IngresoArea"
FOR EACH ROW EXECUTE FUNCTION ingreso_area_coherente();

-- Relleno: usuarias. La primera referencia de cada usuaria a cada área (por fecha de creación) es
-- su primer ingreso; las demás, seguimiento.
INSERT INTO "IngresoArea" ("id", "referidoId", "area", "usuariaId", "hijoId", "ingreso", "createdAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  r."area",
  e."usuariaId",
  NULL,
  (CASE WHEN row_number() OVER (
          PARTITION BY e."usuariaId", r."area" ORDER BY r."createdAt", r."id"
        ) = 1
        THEN 'PRIMER_INGRESO' ELSE 'SEGUIMIENTO' END)::"TipoIngresoArea",
  r."createdAt"
FROM "ReferidoArea" r
JOIN "Expediente" e ON e."id" = r."expedienteId"
WHERE r."area" IN ('JURIDICO', 'PSICOLOGIA', 'MEDICA');

-- Relleno: hijos/as. Cada vez que un área atendió al hijo/a dentro de una referencia (proceso de
-- psicología; cita o consulta médica), ordenado por la primera atención en esa referencia.
WITH atenciones AS (
  SELECT COALESCE(a."referidoId", r."id") AS "referidoId", a."hijoId", a."createdAt" AS "fecha"
  FROM "AtencionPsicologica" a
  LEFT JOIN "ReferidoArea" r ON r."expedienteId" = a."expedienteId" AND r."area" = 'PSICOLOGIA'
  WHERE a."hijoId" IS NOT NULL
  UNION ALL
  SELECT COALESCE(am."referidoId", r."id"), n."hijoId", c."createdAt"
  FROM "CitaMedicaPersona" cp
  JOIN "CitaMedica" c ON c."id" = cp."citaId"
  JOIN "AtencionMedica" am ON am."id" = c."atencionId"
  JOIN "Nino" n ON n."id" = cp."ninoId"
  LEFT JOIN "ReferidoArea" r ON r."expedienteId" = am."expedienteId" AND r."area" = 'MEDICA'
  UNION ALL
  SELECT COALESCE(am."referidoId", r."id"), n."hijoId", cm."createdAt"
  FROM "ConsultaMedica" cm
  JOIN "AtencionMedica" am ON am."id" = cm."atencionId"
  JOIN "Nino" n ON n."id" = cm."ninoId"
  LEFT JOIN "ReferidoArea" r ON r."expedienteId" = am."expedienteId" AND r."area" = 'MEDICA'
),
por_referencia AS (
  SELECT "referidoId", "hijoId", min("fecha") AS "fecha"
  FROM atenciones
  WHERE "referidoId" IS NOT NULL
  GROUP BY "referidoId", "hijoId"
)
INSERT INTO "IngresoArea" ("id", "referidoId", "area", "usuariaId", "hijoId", "ingreso", "createdAt")
SELECT
  gen_random_uuid()::text,
  p."referidoId",
  r."area",
  e."usuariaId",
  p."hijoId",
  (CASE WHEN row_number() OVER (
          PARTITION BY p."hijoId", r."area" ORDER BY p."fecha", r."createdAt", r."id"
        ) = 1
        THEN 'PRIMER_INGRESO' ELSE 'SEGUIMIENTO' END)::"TipoIngresoArea",
  p."fecha"
FROM por_referencia p
JOIN "ReferidoArea" r ON r."id" = p."referidoId"
JOIN "Expediente" e ON e."id" = r."expedienteId";

-- Escritura de aquí en adelante. Bloquea a la persona (FOR UPDATE) para que dos referencias
-- simultáneas no salgan las dos como primer ingreso; es idempotente por (referencia, persona).
CREATE FUNCTION ingreso_area_registrar(p_referido TEXT, p_hijo TEXT) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_area "Rol";
  v_usuaria TEXT;
  v_ya_vino BOOLEAN;
BEGIN
  SELECT r."area", e."usuariaId" INTO v_area, v_usuaria
  FROM "ReferidoArea" r
  JOIN "Expediente" e ON e."id" = r."expedienteId"
  WHERE r."id" = p_referido;

  IF NOT FOUND OR v_area NOT IN ('JURIDICO', 'PSICOLOGIA', 'MEDICA') THEN
    RETURN;
  END IF;

  IF p_hijo IS NULL THEN
    PERFORM 1 FROM "Usuaria" WHERE "id" = v_usuaria FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM "IngresoArea" WHERE "referidoId" = p_referido AND "hijoId" IS NULL
    ) THEN
      RETURN;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM "IngresoArea"
      WHERE "usuariaId" = v_usuaria AND "area" = v_area AND "hijoId" IS NULL
        AND "ingreso" = 'PRIMER_INGRESO'
    ) INTO v_ya_vino;
  ELSE
    PERFORM 1 FROM "HijoUsuaria" WHERE "id" = p_hijo FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM "IngresoArea" WHERE "referidoId" = p_referido AND "hijoId" = p_hijo
    ) THEN
      RETURN;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM "IngresoArea"
      WHERE "hijoId" = p_hijo AND "area" = v_area AND "ingreso" = 'PRIMER_INGRESO'
    ) INTO v_ya_vino;
  END IF;

  INSERT INTO "IngresoArea" ("id", "referidoId", "area", "usuariaId", "hijoId", "ingreso")
  VALUES (
    gen_random_uuid()::text, p_referido, v_area, v_usuaria, p_hijo,
    CASE WHEN v_ya_vino THEN 'SEGUIMIENTO' ELSE 'PRIMER_INGRESO' END::"TipoIngresoArea"
  );
END;
$$;

-- Usuaria: al crearse la referencia.
CREATE FUNCTION ingreso_area_referido() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ingreso_area_registrar(NEW."id", NULL);
  RETURN NULL;
END;
$$;

CREATE TRIGGER "ReferidoArea_ingreso_ins"
AFTER INSERT ON "ReferidoArea"
FOR EACH ROW EXECUTE FUNCTION ingreso_area_referido();

-- Hijo/a en Psicología: al fijarse el hijo/a del proceso (hijoId lo llena un trigger BEFORE).
CREATE FUNCTION ingreso_area_psicologia() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_referido TEXT;
BEGIN
  v_referido := COALESCE(
    NEW."referidoId",
    (SELECT r."id" FROM "ReferidoArea" r
     WHERE r."expedienteId" = NEW."expedienteId" AND r."area" = 'PSICOLOGIA')
  );
  IF v_referido IS NOT NULL THEN
    PERFORM ingreso_area_registrar(v_referido, NEW."hijoId");
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "AtencionPsicologica_ingreso_ins"
AFTER INSERT ON "AtencionPsicologica"
FOR EACH ROW WHEN (NEW."hijoId" IS NOT NULL)
EXECUTE FUNCTION ingreso_area_psicologia();

CREATE TRIGGER "AtencionPsicologica_ingreso_upd"
AFTER UPDATE OF "hijoId", "referidoId" ON "AtencionPsicologica"
FOR EACH ROW WHEN (NEW."hijoId" IS NOT NULL)
EXECUTE FUNCTION ingreso_area_psicologia();

-- Hijo/a en Médica: en su primera cita o consulta dentro de la referencia.
CREATE FUNCTION ingreso_area_medica(p_atencion TEXT, p_nino TEXT) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_referido TEXT;
  v_hijo TEXT;
BEGIN
  SELECT COALESCE(am."referidoId", r."id"), n."hijoId" INTO v_referido, v_hijo
  FROM "AtencionMedica" am
  JOIN "Nino" n ON n."id" = p_nino
  LEFT JOIN "ReferidoArea" r ON r."expedienteId" = am."expedienteId" AND r."area" = 'MEDICA'
  WHERE am."id" = p_atencion;

  IF v_referido IS NOT NULL AND v_hijo IS NOT NULL THEN
    PERFORM ingreso_area_registrar(v_referido, v_hijo);
  END IF;
END;
$$;

CREATE FUNCTION ingreso_area_cita_medica() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ingreso_area_medica(
    (SELECT c."atencionId" FROM "CitaMedica" c WHERE c."id" = NEW."citaId"),
    NEW."ninoId"
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER "CitaMedicaPersona_ingreso_ins"
AFTER INSERT OR UPDATE OF "ninoId" ON "CitaMedicaPersona"
FOR EACH ROW WHEN (NEW."ninoId" IS NOT NULL)
EXECUTE FUNCTION ingreso_area_cita_medica();

CREATE FUNCTION ingreso_area_consulta_medica() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ingreso_area_medica(NEW."atencionId", NEW."ninoId");
  RETURN NULL;
END;
$$;

CREATE TRIGGER "ConsultaMedica_ingreso_ins"
AFTER INSERT OR UPDATE OF "ninoId" ON "ConsultaMedica"
FOR EACH ROW WHEN (NEW."ninoId" IS NOT NULL)
EXECUTE FUNCTION ingreso_area_consulta_medica();

-- Verificación final: cada referencia a un área de atención tiene la fila de su usuaria, y cada
-- persona que ya vino a un área tiene exactamente un primer ingreso ahí.
DO $$
DECLARE
  v_sin_fila INT;
  v_sin_primero INT;
BEGIN
  SELECT count(*) INTO v_sin_fila
  FROM "ReferidoArea" r
  WHERE r."area" IN ('JURIDICO', 'PSICOLOGIA', 'MEDICA')
    AND NOT EXISTS (
      SELECT 1 FROM "IngresoArea" i WHERE i."referidoId" = r."id" AND i."hijoId" IS NULL
    );
  IF v_sin_fila > 0 THEN
    RAISE EXCEPTION 'Hay % referencias sin ingreso de la usuaria', v_sin_fila;
  END IF;

  SELECT count(*) INTO v_sin_primero
  FROM (
    SELECT "usuariaId", "hijoId", "area"
    FROM "IngresoArea"
    GROUP BY "usuariaId", "hijoId", "area"
    HAVING count(*) FILTER (WHERE "ingreso" = 'PRIMER_INGRESO') <> 1
  ) x;
  IF v_sin_primero > 0 THEN
    RAISE EXCEPTION 'Hay % personas sin exactamente un primer ingreso por área', v_sin_primero;
  END IF;

  RAISE NOTICE 'IngresoArea: % filas (% de hijos/as)',
    (SELECT count(*) FROM "IngresoArea"),
    (SELECT count(*) FROM "IngresoArea" WHERE "hijoId" IS NOT NULL);
END;
$$;
