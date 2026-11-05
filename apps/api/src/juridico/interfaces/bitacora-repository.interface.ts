import type { BitacoraPaginaDto, EntradaBitacoraDto } from '@akyuam/shared';

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
  /** La página `pagina` (1 = las más recientes), con el total de páginas del proceso. */
  listarPagina(
    procesoId: string,
    opciones: { pagina: number; porPagina: number },
  ): Promise<BitacoraPaginaDto>;
  /** Actuaciones del equipo en todo el proceso (sin los eventos del sistema). */
  contarActuaciones(procesoId: string): Promise<number>;
  /**
   * `esSistema` de la entrada si existe **y** es de ese proceso; `null` si no. Nunca se busca
   * solo por su id.
   */
  buscarEnProceso(
    entradaId: string,
    procesoId: string,
  ): Promise<{ esSistema: boolean } | null>;
}
