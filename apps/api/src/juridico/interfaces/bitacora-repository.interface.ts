import type { EntradaBitacoraDto, TipoProcesoJuridico } from '@akyuam/shared';

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
  /** Tipos de actuación ya usados en el proceso, el más reciente primero (sin entradas de sistema). */
  tiposUsadosEnProceso(procesoId: string, limite: number): Promise<string[]>;
  /** Tipos de actuación más usados en procesos de ese tipo (sin entradas de sistema). */
  tiposMasUsadosPorTipoProceso(
    tipoProceso: TipoProcesoJuridico,
    limite: number,
  ): Promise<string[]>;
}
