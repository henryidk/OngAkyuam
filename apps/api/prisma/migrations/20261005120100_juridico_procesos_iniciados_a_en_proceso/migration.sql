-- Los procesos nacen En proceso al tomar el caso y ya no existe la acción "Marcar como En
-- proceso". Todo proceso que siga en INICIADO pasa a EN_PROCESO, sin importar su situación:
-- uno suspendido o abandonado que se quedara en INICIADO no podría avanzar nunca al
-- reactivarse. INICIADO se conserva en el enum como primer paso del indicador de avance.

-- Un evento de sistema por proceso, para que la bitácora explique el cambio. Va antes del
-- UPDATE porque se elige a los procesos por su fase actual.
INSERT INTO "NotaAvanceProceso" ("id", "procesoId", "contenido", "tipo", "registradoPorId", "createdAt")
SELECT gen_random_uuid()::text, p."id",
       'Marcado como En proceso: los procesos se trabajan desde que se toma el caso',
       'SISTEMA', p."creadoPorId", now()
FROM "ProcesoJuridico" p
WHERE p."fase" = 'INICIADO';

-- Sube la versión para que una pantalla abierta con el estado viejo reciba un conflicto.
UPDATE "ProcesoJuridico"
SET "fase" = 'EN_PROCESO', "version" = "version" + 1
WHERE "fase" = 'INICIADO';

-- AlterTable
ALTER TABLE "ProcesoJuridico" ALTER COLUMN "fase" SET DEFAULT 'EN_PROCESO';
