import type {
  EstadoAtencionPsicologica,
  FaseProcesoJuridico,
  SituacionProcesoJuridico,
} from '@prisma/client';

export const ESTADO_AREAS_REPOSITORY = Symbol('ESTADO_AREAS_REPOSITORY');

export interface ProcesoJuridicoParaEstado {
  fase: FaseProcesoJuridico;
  situacion: SituacionProcesoJuridico;
}

export interface AtencionPsicologicaParaEstado {
  estado: EstadoAtencionPsicologica;
  psicologa: string | null;
  proximaCita: Date | null;
}

/** Lecturas mínimas que necesitan las estrategias de estado — una por área que la requiere. */
export interface IEstadoAreasRepository {
  procesosJuridicos(expedienteId: string): Promise<ProcesoJuridicoParaEstado[]>;
  atencionPsicologica(
    expedienteId: string,
  ): Promise<AtencionPsicologicaParaEstado | null>;
}
