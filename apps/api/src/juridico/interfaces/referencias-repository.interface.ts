import type { ReferenciaBandejaDto } from '@akyuam/shared';

export const REFERENCIAS_REPOSITORY = Symbol('REFERENCIAS_REPOSITORY');

export interface IReferenciasRepository {
  /** Referencias pendientes: las más antiguas primero. */
  listar(): Promise<ReferenciaBandejaDto[]>;
  /** La referencia a Jurídico del expediente, solo si sigue pendiente. */
  buscarPendientePorExpediente(
    expedienteId: string,
  ): Promise<ReferenciaBandejaDto | null>;
}
