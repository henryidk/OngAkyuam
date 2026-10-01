import type {
  ReferenciaBandejaDto,
  VistaBandejaJuridico,
} from '@akyuam/shared';

export const REFERENCIAS_REPOSITORY = Symbol('REFERENCIAS_REPOSITORY');

export interface DevolverReferenciaParams {
  referidoId: string;
  motivo: string;
  devueltoPorId: string;
}

export interface IReferenciasRepository {
  /** Pendientes: urgentes primero y luego las más antiguas. Devueltas: las más recientes. */
  listar(vista: VistaBandejaJuridico): Promise<ReferenciaBandejaDto[]>;
  /** La referencia a Jurídico del expediente, solo si sigue pendiente. */
  buscarPendientePorExpediente(
    expedienteId: string,
  ): Promise<ReferenciaBandejaDto | null>;
  /**
   * Marca la referencia como devuelta. `null` — sin escribir nada — si no existe, no es de
   * Jurídico o ya no está pendiente.
   */
  devolver(
    params: DevolverReferenciaParams,
  ): Promise<{ expedienteId: string } | null>;
}
