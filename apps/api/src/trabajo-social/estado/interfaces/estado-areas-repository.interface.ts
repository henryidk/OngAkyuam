import type {
  EstadoAtencionMedica,
  EstadoAtencionPsicologica,
  MotivoAltaMedica,
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

/** La atención médica más reciente del expediente, con lo justo para el estado (nada clínico). */
export interface AtencionMedicaParaEstado {
  estado: EstadoAtencionMedica;
  motivoAlta: MotivoAltaMedica | null;
  fechaAlta: string | null;
  /** Abierta después de la referencia vigente: si no, la referencia sigue pendiente. */
  posteriorAReferencia: boolean;
  proximaCita: Date | null;
  /** Hay una cita PROGRAMADA que ya terminó y nadie registró. */
  citaSinRegistrar: boolean;
}

/** Lecturas mínimas que necesitan las estrategias de estado — una por área que la requiere. */
export interface IEstadoAreasRepository {
  procesosJuridicos(expedienteId: string): Promise<ProcesoJuridicoParaEstado[]>;
  atencionPsicologica(
    expedienteId: string,
  ): Promise<AtencionPsicologicaParaEstado | null>;
  atencionMedica(
    expedienteId: string,
  ): Promise<AtencionMedicaParaEstado | null>;
}
