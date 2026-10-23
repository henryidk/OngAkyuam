import type { EntradaBitacoraDto } from '@akyuam/shared';

export const BITACORA_REPOSITORY = Symbol('BITACORA_REPOSITORY');

export interface RegistrarEntradaParams {
  procesoId: string;
  /** Texto libre ya normalizado. */
  tipo: string;
  /** `true` solo en los eventos que genera el propio backend, nunca por pedido de la operadora. */
  esSistema: boolean;
  contenido: string;
  registradoPorId: string;
}

export interface IBitacoraRepository {
  /** Guarda la entrada y marca el proceso como recién trabajado (`ultimaActuacionEn`). */
  registrar(params: RegistrarEntradaParams): Promise<EntradaBitacoraDto>;
  /** Reescribe el texto de una entrada de sistema (p. ej. el conteo de una tanda de subida). */
  actualizarContenido(entradaId: string, contenido: string): Promise<void>;
  /** Las más recientes primero, con tope. */
  listarPorProceso(procesoId: string): Promise<EntradaBitacoraDto[]>;
  /**
   * `esSistema` de la entrada si existe **y** es de ese proceso; `null` si no. Nunca se busca
   * solo por su id.
   */
  buscarEnProceso(
    entradaId: string,
    procesoId: string,
  ): Promise<{ esSistema: boolean } | null>;
}
