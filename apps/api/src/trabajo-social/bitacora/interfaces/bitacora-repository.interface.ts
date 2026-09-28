import type { DetallesAuditoria } from '../../eventos/plantillas-eventos';

export const BITACORA_REPOSITORY = Symbol('BITACORA_REPOSITORY');

export interface EventoBitacoraRow {
  id: string;
  accion: string;
  detalles: DetallesAuditoria;
  createdAt: Date;
  autor: string | null;
  numeroExpediente: string | null;
}

export interface IBitacoraRepository {
  existeUsuaria(usuariaId: string): Promise<boolean>;
  /** Eventos de todos los casos de la usuaria y de sus datos personales, más reciente primero. */
  eventosDeUsuaria(
    usuariaId: string,
    acciones: string[],
    limite: number,
  ): Promise<EventoBitacoraRow[]>;
}
