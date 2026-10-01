import type { EntradaBitacoraDto, TipoEntradaBitacora } from '@akyuam/shared';

export const BITACORA_REPOSITORY = Symbol('BITACORA_REPOSITORY');

export interface RegistrarEntradaParams {
  procesoId: string;
  tipo: TipoEntradaBitacora;
  contenido: string;
  registradoPorId: string;
}

export interface IBitacoraRepository {
  /** Guarda la entrada y marca el proceso como recién trabajado (`ultimaActuacionEn`). */
  registrar(params: RegistrarEntradaParams): Promise<EntradaBitacoraDto>;
  /** Reescribe el texto de una entrada `SISTEMA` (p. ej. el conteo de una tanda de subida). */
  actualizarContenido(entradaId: string, contenido: string): Promise<void>;
  /** Las más recientes primero, con tope. */
  listarPorProceso(procesoId: string): Promise<EntradaBitacoraDto[]>;
}
