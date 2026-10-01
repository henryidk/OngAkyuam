import type { TipoRegistro } from '@prisma/client';

export const EGRESO_REPOSITORY = Symbol('EGRESO_REPOSITORY');

/** Lo mínimo del expediente para decidir si se puede registrar su egreso del albergue. */
export interface ExpedienteParaEgreso {
  tipoRegistro: TipoRegistro;
  /** "YYYY-MM-DD"; un caso INTERNA antiguo puede no tenerla capturada. */
  fechaIngresoAlbergue: string | null;
  fechaEgresoAlbergue: string | null;
}

export interface IEgresoRepository {
  buscarExpediente(expedienteId: string): Promise<ExpedienteParaEgreso | null>;
  /**
   * Guarda la fecha solo si el caso sigue en el albergue (INTERNA sin egreso). Devuelve `false`
   * si otra petición registró el egreso entre la validación y la escritura.
   */
  registrarEgreso(expedienteId: string, fechaEgreso: string): Promise<boolean>;
}
