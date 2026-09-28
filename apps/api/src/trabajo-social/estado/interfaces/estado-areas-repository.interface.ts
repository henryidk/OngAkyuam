import type {
  EstadoAtencionPsicologica,
  EstadoProcesoJuridico,
} from '@prisma/client';

export const ESTADO_AREAS_REPOSITORY = Symbol('ESTADO_AREAS_REPOSITORY');

export interface AtencionPsicologicaParaEstado {
  estado: EstadoAtencionPsicologica;
  psicologa: string | null;
  proximaCita: Date | null;
}

/** Lecturas mínimas que necesitan las estrategias de estado — una por área que la requiere. */
export interface IEstadoAreasRepository {
  estadosProcesosJuridicos(
    expedienteId: string,
  ): Promise<EstadoProcesoJuridico[]>;
  atencionPsicologica(
    expedienteId: string,
  ): Promise<AtencionPsicologicaParaEstado | null>;
}
