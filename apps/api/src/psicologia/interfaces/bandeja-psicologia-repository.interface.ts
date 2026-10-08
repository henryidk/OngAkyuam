import type {
  CasoPorAgendarDto,
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

export interface IBandejaPsicologiaRepository {
  /** Referencias a Psicología que nadie ha tomado, de la más antigua a la más reciente. */
  listarSinTomar(): Promise<ReferenciaBandejaPsicologiaDto[]>;
  /** Casos tomados por esta psicóloga que todavía no tienen primera cita. */
  listarPorAgendar(psicologaId: string): Promise<CasoPorAgendarDto[]>;
  /** `null` si la referencia no existe o no es de Psicología — indistinguibles desde afuera. */
  buscarReferencia(
    referidoId: string,
    psicologaId: string,
  ): Promise<ReferenciaPsicologia | null>;
}
