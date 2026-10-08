import type {
  CasoPorAgendarDto,
  CasoPorReasignarDto,
  ReferenciaBandejaPsicologiaDto,
} from '@akyuam/shared';

export const BANDEJA_PSICOLOGIA_REPOSITORY = Symbol(
  'BANDEJA_PSICOLOGIA_REPOSITORY',
);

/**
 * En qué está una referencia para la psicóloga que pregunta:
 * - `SIN_TOMAR`: nadie se ha hecho cargo; cualquiera puede tomarla.
 * - `MIA`: la tomó ella y su proceso sigue sin cerrar.
 * - `NO_DISPONIBLE`: la tomó otra psicóloga, o el proceso que nació de ella ya se cerró.
 */
export type SituacionReferencia = 'SIN_TOMAR' | 'MIA' | 'NO_DISPONIBLE';

export interface ReferenciaPsicologia {
  referidoId: string;
  expedienteId: string;
  expedienteNumero: string;
  usuariaId: string;
  situacion: SituacionReferencia;
  /** El proceso sin cerrar de esta psicóloga; solo viene cuando la situación es `MIA`. */
  procesoId: string | null;
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
  /** El caso no tenía primera cita: queda en "Casos por agendar" de la nueva dueña. */
  referidoIdPorAgendar: string | null;
  citasCanceladas: number;
}

export interface IBandejaPsicologiaRepository {
  /** Referencias a Psicología que nadie ha tomado, de la más antigua a la más reciente. */
  listarSinTomar(): Promise<ReferenciaBandejaPsicologiaDto[]>;
  /** Casos tomados por esta psicóloga que todavía no tienen primera cita. */
  listarPorAgendar(psicologaId: string): Promise<CasoPorAgendarDto[]>;
  /** Casos y procesos abiertos cuya psicóloga tiene la cuenta desactivada, del más antiguo al más reciente. */
  listarPorReasignar(): Promise<CasoPorReasignarDto[]>;
  /**
   * Cambio de dueña atómico: solo pasa si el proceso sigue abierto y su psicóloga sigue
   * desactivada. Cancela las citas programadas (no se heredan). `null` si no existe, si no
   * está por reasignar o si otra psicóloga lo tomó primero — indistinguibles desde afuera.
   */
  reasignar(params: ReasignarProcesoParams): Promise<ProcesoReasignado | null>;
  /** `null` si la referencia no existe o no es de Psicología — indistinguibles desde afuera. */
  buscarReferencia(
    referidoId: string,
    psicologaId: string,
  ): Promise<ReferenciaPsicologia | null>;
}
