import type { ProcesoVinculadoDto } from '@akyuam/shared';

export const NUMERO_JUDICIAL_REPOSITORY = Symbol('NUMERO_JUDICIAL_REPOSITORY');

export interface AsignarNumeroJudicialParams {
  procesoId: string;
  /** Versión que leyó quien pide el cambio (concurrencia optimista). */
  version: number;
  numeroJudicial: string;
  usuarioId: string;
  textoBitacora: string;
}

export interface INumeroJudicialRepository {
  /**
   * Otros procesos con acceso que ya usan ese número, sin distinguir mayúsculas: "c-01" y
   * "C-01" son el mismo expediente judicial.
   */
  buscarProcesosConNumero(
    numeroJudicial: string,
    exceptoProcesoId: string,
  ): Promise<ProcesoVinculadoDto[]>;
  /** Guarda el número y anota la bitácora. `false` — sin escribir nada — si la versión cambió. */
  asignar(params: AsignarNumeroJudicialParams): Promise<boolean>;
}
