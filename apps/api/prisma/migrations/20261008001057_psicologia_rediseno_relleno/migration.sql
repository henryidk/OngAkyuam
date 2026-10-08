-- Rediseño de Psicología, paso 2 de 4 (rellenar): completa las columnas nuevas en los procesos
-- que ya existen. Solo UPDATE, no borra filas ni columnas. Cada sentencia filtra por lo que aún
-- no está relleno, así que volver a correrla no cambia nada.

-- 1. Referencia de origen: hasta hoy cada expediente tiene a lo sumo una referencia a Psicología.
UPDATE "AtencionPsicologica" a
SET "referidoId" = r."id"
FROM "ReferidoArea" r
WHERE r."expedienteId" = a."expedienteId"
  AND r."area" = 'PSICOLOGIA'
  AND a."referidoId" IS NULL;

-- 2. `fechaInicio` pasa a significar "cuándo se abrió el proceso" (al programar la primera
--    cita); antes se llenaba al pasar a Seguimiento. Un caso tomado que aún no tiene citas no
--    ha abierto proceso y se queda sin fecha de inicio.
UPDATE "AtencionPsicologica" a
SET "fechaInicio" = c."primera"
FROM (
  SELECT "atencionId", min("createdAt") AS "primera"
  FROM "CitaPsicologica"
  GROUP BY "atencionId"
) c
WHERE c."atencionId" = a."id"
  AND (a."fechaInicio" IS NULL OR a."fechaInicio" > c."primera");

-- 3. Procesos ya cerrados: el motivo era texto libre, así que pasan al catálogo como OTRO y el
--    texto se conserva íntegro como resumen. `motivoCierre` no se toca (se elimina en el paso 4).
UPDATE "AtencionPsicologica"
SET "motivoCierreCatalogo" = 'OTRO',
    "resumenCierre" = COALESCE(NULLIF(btrim("motivoCierre"), ''), 'Sin detalle registrado')
WHERE "estado" = 'CIERRE'
  AND "motivoCierreCatalogo" IS NULL;

-- 4. Un proceso cerrado siempre tiene fecha de cierre y de inicio (lo exigirá el paso 3 de 4).
UPDATE "AtencionPsicologica"
SET "fechaCierre" = "updatedAt"
WHERE "estado" = 'CIERRE'
  AND "fechaCierre" IS NULL;

UPDATE "AtencionPsicologica"
SET "fechaInicio" = LEAST(COALESCE("tomadaEn", "createdAt"), "fechaCierre")
WHERE "estado" = 'CIERRE'
  AND "fechaInicio" IS NULL;
