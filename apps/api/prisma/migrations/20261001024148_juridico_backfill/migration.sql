-- Backfill del rediseño de Jurídico (solo UPDATE/INSERT, idempotente). Rellena las columnas
-- que juridico_expandir_estados agregó como nullable, para que juridico_restricciones pueda
-- volverlas NOT NULL.

-- Consecutivo por expediente según orden de creación
WITH numerados AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "expedienteId" ORDER BY "createdAt", "id") AS n
  FROM "ProcesoJuridico"
)
UPDATE "ProcesoJuridico" p SET "consecutivo" = n.n
FROM numerados n WHERE p."id" = n."id" AND p."consecutivo" IS NULL;

-- Estado viejo → fase/situación
UPDATE "ProcesoJuridico" SET "fase" = 'FINALIZADO', "situacion" = 'ACTIVO'
WHERE "estado" = 'CERRADO' AND "fase" IS NULL;

UPDATE "ProcesoJuridico" SET "fase" = 'EN_PROCESO', "situacion" = 'ACTIVO'
WHERE "estado" = 'INICIADO' AND "fase" IS NULL;

-- Procesos cerrados antes de existir la forma de finalización
UPDATE "ProcesoJuridico"
SET "formaFinalizacion" = 'OTROS',
    "detalleFinalizacion" = 'Cerrado antes de registrar la forma de finalización'
WHERE "fase" = 'FINALIZADO' AND "formaFinalizacion" IS NULL;

-- Un proceso finalizado siempre lleva fecha de cierre (lo exige el CHECK de la migración
-- siguiente). Si alguno quedó cerrado sin fecha, se usa el día de su última modificación.
UPDATE "ProcesoJuridico"
SET "fechaCierre" = ("updatedAt" AT TIME ZONE 'America/Guatemala')::date
WHERE "fase" = 'FINALIZADO' AND "fechaCierre" IS NULL;

-- Y al revés: uno no finalizado no puede tener fecha de cierre.
UPDATE "ProcesoJuridico" SET "fechaCierre" = NULL
WHERE "fase" <> 'FINALIZADO' AND "fechaCierre" IS NOT NULL;

-- Abandonos existentes → situación ABANDONADO (solo si no estaba cerrado)
UPDATE "ProcesoJuridico" p SET "situacion" = 'ABANDONADO'
FROM "AbandonoProceso" a
WHERE a."procesoId" = p."id" AND p."fase" <> 'FINALIZADO';

UPDATE "AbandonoProceso" SET "motivoCatalogo" = 'OTRO' WHERE "motivoCatalogo" IS NULL;

-- Última actuación = la más reciente entre creación, notas y documentos
UPDATE "ProcesoJuridico" p SET "ultimaActuacionEn" = GREATEST(
  p."createdAt",
  COALESCE((SELECT max(n."createdAt") FROM "NotaAvanceProceso" n WHERE n."procesoId" = p."id"), p."createdAt"),
  COALESCE((SELECT max(d."createdAt") FROM "DocumentoProceso"  d WHERE d."procesoId" = p."id"), p."createdAt")
)
WHERE p."ultimaActuacionEn" IS NULL;

-- Carpeta "Documentos generales" por proceso con documentos, y asignación
INSERT INTO "CarpetaDocumentoProceso" ("id","procesoId","nombre","nombreNorm","creadaPorId","createdAt","updatedAt")
SELECT gen_random_uuid(), p."id", 'Documentos generales', 'documentos generales', p."creadoPorId", now(), now()
FROM "ProcesoJuridico" p
WHERE EXISTS (SELECT 1 FROM "DocumentoProceso" d WHERE d."procesoId" = p."id")
ON CONFLICT ("procesoId","nombreNorm") DO NOTHING;

UPDATE "DocumentoProceso" d SET "carpetaId" = c."id"
FROM "CarpetaDocumentoProceso" c
WHERE c."procesoId" = d."procesoId" AND c."nombreNorm" = 'documentos generales' AND d."carpetaId" IS NULL;

-- Referencias que ya tienen procesos se consideran atendidas
UPDATE "ReferidoArea" r SET "atendidoEn" = sub.primero
FROM (SELECT "expedienteId", min("createdAt") AS primero FROM "ProcesoJuridico" GROUP BY "expedienteId") sub
WHERE r."area" = 'JURIDICO' AND r."expedienteId" = sub."expedienteId" AND r."atendidoEn" IS NULL;
