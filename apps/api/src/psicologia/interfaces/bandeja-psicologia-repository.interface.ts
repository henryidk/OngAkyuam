import type {
  CasoPorReasignarDto,
  ExpedientePreviaTomaDto,
  ReferenciaBandejaPsicologiaDto,
  ReferenciaParaAgendarDto,
} from '@akyuam/shared';

export const BANDEJA_PSICOLOGIA_REPOSITORY = Symbol(
  'BANDEJA_PSICOLOGIA_REPOSITORY',
);

/**
 * En qué está una referencia:
 * - `SIN_TOMAR`: nadie se ha hecho cargo; cualquiera puede agendarle la primera cita o atenderla.
 * - `TOMADA`: una psicóloga ya abrió un proceso en ese expediente.
 */
export type SituacionReferencia = 'SIN_TOMAR' | 'TOMADA';

export interface ReferenciaPsicologia {
  referidoId: string;
  expedienteId: string;
  expedienteNumero: string;
  usuariaId: string;
  situacion: SituacionReferencia;
}

export interface ReasignarProcesoParams {
  procesoId: string;
  /** Quien lo toma: pasa a ser la dueña. */
  psicologaId: string;
}

export interface ProcesoReasignado {
  procesoId: string;
  expedienteId: string;
  psicologaAnteriorId: string;
  citasCanceladas: number;
}

export interface IBandejaPsicologiaRepository {
  /**
   * Referencias a Psicología que nadie ha tomado, de la más antigua a la más reciente. Sin la
   * reserva: esa vive en Redis y la agrega el servicio.
   */
  listarSinTomar(): Promise<Omit<ReferenciaBandejaPsicologiaDto, 'reserva'>[]>;
  /**
   * Una referencia sin tomar con las personas a las que se les puede abrir proceso; null si no
   * existe, no es de Psicología o ya la tomaron — indistinguibles desde afuera.
   */
  buscarParaAgendar(
    referidoId: string,
  ): Promise<ReferenciaParaAgendarDto | null>;
  /** Casos y procesos abiertos cuya psicóloga tiene la cuenta desactivada, del más antiguo al más reciente. */
  listarPorReasignar(): Promise<CasoPorReasignarDto[]>;
  /**
   * Cambio de dueña atómico: solo pasa si el proceso sigue abierto y su psicóloga sigue
   * desactivada. Cancela las citas programadas (no se heredan). `null` si no existe, si no
   * está por reasignar o si otra psicóloga lo tomó primero — indistinguibles desde afuera.
   */
  reasignar(params: ReasignarProcesoParams): Promise<ProcesoReasignado | null>;
  /**
   * Vista previa del expediente de una referencia de Psicología, sin agresor, dirección,
   * teléfono, DPI ni ubicación: esas columnas ni siquiera se piden a la base. `null` si no existe.
   */
  obtenerPreviaToma(
    referidoId: string,
  ): Promise<ExpedientePreviaTomaDto | null>;
  /** `null` si la referencia no existe o no es de Psicología — indistinguibles desde afuera. */
  buscarReferencia(referidoId: string): Promise<ReferenciaPsicologia | null>;
}
