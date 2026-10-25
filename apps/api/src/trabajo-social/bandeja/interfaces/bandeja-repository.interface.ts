import type { IndicadoresTs, TipoRegistro } from '@akyuam/shared';

export const BANDEJA_REPOSITORY = Symbol('BANDEJA_REPOSITORY');

/** Primeras filas de una cola más su total real. */
export interface ColaRows<TFila> {
  filas: TFila[];
  total: number;
}

interface CasoActivoRow {
  expedienteId: string;
  usuariaId: string;
  numero: string;
  nombres: string;
  apellidos: string;
}

export interface PendienteReferirRow extends CasoActivoRow {
  tipoRegistro: TipoRegistro;
  casoCreadoEn: Date;
}

export interface EnAlbergueRow extends CasoActivoRow {
  fechaIngresoAlbergue: Date | null;
  cantidadNinos: number;
}

export interface IBandejaRepository {
  pendientesReferir(limite: number): Promise<ColaRows<PendienteReferirRow>>;
  enAlbergue(limite: number): Promise<ColaRows<EnAlbergueRow>>;
  /** Cifras globales del tablero sobre el caso activo de cada usuaria. */
  indicadores(): Promise<IndicadoresTs>;
}
