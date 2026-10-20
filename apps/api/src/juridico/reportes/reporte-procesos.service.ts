import { Inject, Injectable } from '@nestjs/common';
import {
  anioCalendarioGT,
  CATEGORIA_POR_TIPO_PROCESO,
  CATEGORIAS_PROCESO_JURIDICO,
  ESTADOS_VISIBLES_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_ESTADO_VISIBLE,
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  etiquetaCartera,
  fechaCalendarioGT,
  FILAS_VISTA_PREVIA_REPORTE,
  formatFechaGT,
  FORMAS_FINALIZACION_PROCESO,
  horaGT,
  type ConteoReporte,
  type FechaHoraAudienciaReporte,
  type FilaReporteJuridico,
  type ReporteProcesosJuridico,
  type ReporteProcesosJuridicoQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { EXPORTADOR_HOJA_CALCULO } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  ColumnaHoja,
  IExportadorHojaCalculo,
  ValorCeldaHoja,
} from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import { REPORTE_PROCESOS_REPOSITORY } from '../interfaces/reporte-procesos-repository.interface';
import type {
  ConteoProcesosRow,
  FilaProcesoRow,
  FiltroReporteProcesos,
  IReporteProcesosRepository,
} from '../interfaces/reporte-procesos-repository.interface';
import {
  aFiltroCartera,
  detallesCartera,
  sufijoArchivo,
  type ArchivoReporte,
} from './cartera-reporte';

function aFiltro(
  query: ReporteProcesosJuridicoQuery,
  anioActual: number,
): FiltroReporteProcesos {
  return {
    ...aFiltroCartera(query, anioActual),
    estado: query.estado === 'TODOS' ? null : query.estado,
    abogadaId: query.abogadaId ?? null,
    tipo: query.tipo ?? null,
  };
}

/** Solo filtros: nunca filas ni datos de personas en `AuditLog.detalles`. */
function detallesAuditoria(filtro: FiltroReporteProcesos) {
  return {
    reporte: 'PROCESOS_JURIDICOS',
    ...detallesCartera(filtro),
    estado: filtro.estado ?? 'TODOS',
    abogadaId: filtro.abogadaId,
    tipo: filtro.tipo,
  };
}

function fechaHoraAudiencia(
  inicio: Date | null,
): FechaHoraAudienciaReporte | null {
  return inicio
    ? { fecha: fechaCalendarioGT(inicio), hora: horaGT(inicio) }
    : null;
}

export function aFilaReporte(
  row: FilaProcesoRow,
  anioActual: number,
): FilaReporteJuridico {
  // La forma y la fecha de cierre solo describen un proceso finalizado.
  const finalizado = row.estado === 'FINALIZADO';
  return {
    numero: row.numero,
    expedienteNumero: row.expedienteNumero,
    numeroProceso: row.consecutivo,
    usuaria: `${row.nombres} ${row.apellidos}`,
    tipo: row.tipo,
    fechaInicio: row.fechaInicio,
    abogada: row.abogada,
    estado: row.estado,
    formaFinalizacion: finalizado ? row.formaFinalizacion : null,
    fechaCierre: finalizado ? row.fechaCierre : null,
    numeroJudicial: row.numeroJudicial,
    cartera: etiquetaCartera(
      { fechaInicio: row.fechaInicio, abierto: row.abierto },
      anioActual,
    ),
    proximaAudiencia: fechaHoraAudiencia(row.proximaAudiencia),
    ultimaAudienciaRealizada: fechaHoraAudiencia(row.ultimaAudienciaRealizada),
  };
}

function sumarPor<K extends string>(
  conteos: ConteoProcesosRow[],
  clave: (conteo: ConteoProcesosRow) => K | null,
): Map<K, number> {
  const totales = new Map<K, number>();
  for (const conteo of conteos) {
    const valor = clave(conteo);
    if (valor !== null) {
      totales.set(valor, (totales.get(valor) ?? 0) + conteo.total);
    }
  }
  return totales;
}

/**
 * Desgloses a partir de los conteos ya agrupados en SQL. Todas las categorías del catálogo,
 * aunque tengan 0: así las barras no cambian de lugar de un periodo a otro.
 */
export function armarDesgloses(
  conteos: ConteoProcesosRow[],
): ReporteProcesosJuridico['desgloses'] {
  const porEstado = sumarPor(conteos, (c) => c.estado);
  const porForma = sumarPor(conteos, (c) =>
    c.estado === 'FINALIZADO' ? c.formaFinalizacion : null,
  );
  const porCategoria = sumarPor(
    conteos,
    (c) => CATEGORIA_POR_TIPO_PROCESO[c.tipo],
  );

  const estado: ConteoReporte[] = ESTADOS_VISIBLES_PROCESO.map((clave) => ({
    clave,
    etiqueta: ETIQUETAS_ESTADO_VISIBLE[clave],
    total: porEstado.get(clave) ?? 0,
  }));
  const formaFinalizacion: ConteoReporte[] = FORMAS_FINALIZACION_PROCESO.map(
    (clave) => ({
      clave,
      etiqueta: ETIQUETAS_FORMA_FINALIZACION[clave],
      total: porForma.get(clave) ?? 0,
    }),
  );
  const categoria: ConteoReporte[] = CATEGORIAS_PROCESO_JURIDICO.map(
    (clave) => ({
      clave,
      etiqueta: ETIQUETAS_CATEGORIA_PROCESO[clave],
      total: porCategoria.get(clave) ?? 0,
    }),
  );
  return { estado, formaFinalizacion, categoria };
}

/** Columnas del Excel, en el mismo orden que la vista previa (planaudiencias.md §8.6, B). */
export const COLUMNAS_PROCESOS: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'No. expediente', ancho: 14, tipo: 'texto' },
  { titulo: 'No. proceso', ancho: 10, tipo: 'numero' },
  { titulo: 'Usuaria', ancho: 32, tipo: 'texto' },
  { titulo: 'Tipo de proceso', ancho: 34, tipo: 'texto' },
  { titulo: 'Fecha de inicio', ancho: 12, tipo: 'fecha' },
  { titulo: 'Abogada', ancho: 26, tipo: 'texto' },
  { titulo: 'Estado', ancho: 12, tipo: 'texto' },
  { titulo: 'Forma de finalización', ancho: 16, tipo: 'texto' },
  { titulo: 'Fecha de cierre', ancho: 12, tipo: 'fecha' },
  { titulo: 'No. judicial', ancho: 20, tipo: 'texto' },
  { titulo: 'Cartera', ancho: 18, tipo: 'texto' },
  { titulo: 'Próxima audiencia', ancho: 17, tipo: 'texto' },
  { titulo: 'Última audiencia realizada', ancho: 17, tipo: 'texto' },
];

/** "21/10/2026 09:30": texto, porque la columna de fecha de Excel no lleva hora. */
function celdaAudiencia(audiencia: FechaHoraAudienciaReporte | null): string {
  return audiencia ? `${formatFechaGT(audiencia.fecha)} ${audiencia.hora}` : '';
}

export function aFilaHoja(fila: FilaReporteJuridico): ValorCeldaHoja[] {
  return [
    fila.numero,
    fila.expedienteNumero,
    fila.numeroProceso,
    fila.usuaria,
    ETIQUETAS_TIPO_PROCESO_JURIDICO[fila.tipo],
    fila.fechaInicio,
    fila.abogada ?? '',
    ETIQUETAS_ESTADO_VISIBLE[fila.estado],
    fila.formaFinalizacion
      ? ETIQUETAS_FORMA_FINALIZACION[fila.formaFinalizacion]
      : '',
    fila.fechaCierre,
    fila.numeroJudicial ?? '',
    fila.cartera,
    celdaAudiencia(fila.proximaAudiencia),
    celdaAudiencia(fila.ultimaAudienciaRealizada),
  ];
}

@Injectable()
export class ReporteProcesosService {
  constructor(
    @Inject(REPORTE_PROCESOS_REPOSITORY)
    private readonly repositorio: IReporteProcesosRepository,
    @Inject(EXPORTADOR_HOJA_CALCULO)
    private readonly exportador: IExportadorHojaCalculo,
    private readonly auditService: AuditService,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  async vistaPrevia(
    query: ReporteProcesosJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ReporteProcesosJuridico> {
    const filtro = aFiltro(query, this.anioActual());
    const [filas, conteos, personas] = await Promise.all([
      this.repositorio.filas(filtro, FILAS_VISTA_PREVIA_REPORTE),
      this.repositorio.conteos(filtro),
      this.repositorio.totalesPersonas(filtro),
    ]);

    // La vista previa muestra nombres de usuarias: se audita igual que el reporte de TS.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_CONSULTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: detallesAuditoria(filtro),
    });

    return {
      totales: {
        procesos: conteos.reduce((suma, conteo) => suma + conteo.total, 0),
        ...personas,
      },
      desgloses: armarDesgloses(conteos),
      vistaPrevia: filas.map((fila) => aFilaReporte(fila, filtro.anioActual)),
    };
  }

  async exportar(
    query: ReporteProcesosJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const filtro = aFiltro(query, this.anioActual());
    const filas = await this.repositorio.filas(filtro, null);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Procesos jurídicos',
      columnas: COLUMNAS_PROCESOS,
      filas: filas.map((fila) =>
        aFilaHoja(aFilaReporte(fila, filtro.anioActual)),
      ),
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_JURIDICO_EXPORTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { ...detallesAuditoria(filtro), filas: filas.length },
    });

    return {
      contenido,
      nombreArchivo: `procesos-juridicos_${sufijoArchivo(filtro, fechaCalendarioGT(this.reloj.ahora()))}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }

  /** Año en curso en Guatemala: separa la cartera del año de la de seguimiento. */
  private anioActual(): number {
    return anioCalendarioGT(this.reloj.ahora());
  }
}
