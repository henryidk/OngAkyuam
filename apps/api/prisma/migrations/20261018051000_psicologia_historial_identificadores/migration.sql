BEGIN;
-- Preserve the reassignment history of the processes separated by the previous migration.
INSERT INTO "ReasignacionAtencionPsicologica" (id,"atencionId","dePsicologaId","aPsicologaId","createdAt")
SELECT gen_random_uuid()::text, hijo.id, r."dePsicologaId",r."aPsicologaId",r."createdAt"
FROM "ReasignacionAtencionPsicologica" r
JOIN "AtencionPsicologica" hijo ON hijo.id=md5('psicologia-persona:' || r."atencionId" || ':' || hijo."ninoId")::uuid::text
WHERE hijo."ninoId" IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM "ReasignacionAtencionPsicologica" x WHERE x."atencionId"=hijo.id AND x."dePsicologaId"=r."dePsicologaId" AND x."aPsicologaId"=r."aPsicologaId" AND x."createdAt"=r."createdAt"
);
-- Deterministic historical identifiers must also satisfy the API's RFC UUID validation.
-- Foreign keys use ON UPDATE CASCADE: sessions, documents and history retain their links.
UPDATE "AtencionPsicologica"
SET id=overlay(overlay(id placing '4' from 15 for 1) placing '8' from 20 for 1)
WHERE "ninoId" IS NOT NULL AND id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
COMMIT;
