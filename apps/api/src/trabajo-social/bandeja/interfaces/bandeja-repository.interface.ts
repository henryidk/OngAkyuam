import type {
  AreaAtencion,
  EstadoTs,
  ResumenMesTs,
  TipoDocumento,
  TipoRegistro,
} from '@akyuam/shared';
import type { DetallesAuditoria } from '../../eventos/plantillas-eventos';

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

export interface DocumentoPendienteRow extends CasoActivoRow {
  faltantes: TipoDocumento[];
}

export interface EnAlbergueRow extends CasoActivoRow {
  fechaIngresoAlbergue: Date | null;
  cantidadNinos: number;
}

export interface RecienteRow extends CasoActivoRow {
  areas: AreaAtencion[];
  estado: EstadoTs;
}

export interface NovedadRow {
  id: string;
  accion: string;
  detalles: DetallesAuditoria;
  createdAt: Date;
  expedienteId: string;
  usuariaId: string;
  nombres: string;
  apellidos: string;
}

export interface IBandejaRepository {
  pendientesReferir(limite: number): Promise<ColaRows<PendienteReferirRow>>;
  documentosPendientes(
    limite: number,
  ): Promise<ColaRows<DocumentoPendienteRow>>;
  enAlbergue(limite: number): Promise<ColaRows<EnAlbergueRow>>;
  recientes(limite: number): Promise<RecienteRow[]>;
  /** Eventos de las acciones dadas en los casos que `usuarioId` registró o refirió. */
  novedades(
    usuarioId: string,
    acciones: string[],
    limite: number,
  ): Promise<NovedadRow[]>;
  /** Mes calendario de Guatemala: `inicio`/`fin` son instantes, `anio`/`mes` para las columnas `@db.Date`. */
  resumenMes(params: {
    anio: number;
    mes: number;
    inicio: Date;
    fin: Date;
  }): Promise<ResumenMesTs>;
}
