-- Las audiencias son historia judicial de la usuaria y nunca se borran (planaudiencias.md §6.1):
-- un proceso con audiencias ya no se borra en cascada, y una audiencia con documentos o con una
-- reprogramación que la referencia tampoco. Solo se reemplazan las 3 llaves foráneas: ningún dato
-- se borra ni se modifica.

-- DropForeignKey
ALTER TABLE "AudienciaJuridica" DROP CONSTRAINT "AudienciaJuridica_procesoId_fkey";

-- DropForeignKey
ALTER TABLE "AudienciaJuridica" DROP CONSTRAINT "AudienciaJuridica_reprogramadaDesdeId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoProceso" DROP CONSTRAINT "DocumentoProceso_audienciaId_fkey";

-- AddForeignKey
ALTER TABLE "DocumentoProceso" ADD CONSTRAINT "DocumentoProceso_audienciaId_fkey" FOREIGN KEY ("audienciaId") REFERENCES "AudienciaJuridica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaJuridica" ADD CONSTRAINT "AudienciaJuridica_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ProcesoJuridico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienciaJuridica" ADD CONSTRAINT "AudienciaJuridica_reprogramadaDesdeId_fkey" FOREIGN KEY ("reprogramadaDesdeId") REFERENCES "AudienciaJuridica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
