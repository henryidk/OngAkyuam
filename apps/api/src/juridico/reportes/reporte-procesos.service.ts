import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORIA_POR_TIPO_PROCESO,
  CATEGORIAS_PROCESO_JURIDICO,
  ESTADOS_VISIBLES_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_ESTADO_VISIBLE,
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  etiquetaProceso,
  etiquetasTipologia,
  fechaCalendarioGT,
  FILAS_VISTA_PREVIA_REPORTE,
  formatFechaGT,
  FORMAS_FINALIZACION_PROCESO,
  procedenciaParaReporte,
  type AvanceReporte,
  type ConteoReporte,
  type FilaReporteJuridico,
  type ReporteProcesosJuridico,
  type ReporteProcesosJuridicoQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
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

function aFiltro(query: ReporteProcesosJuridicoQuery): FiltroReporteProcesos {
  return {
    ...aFiltroCartera(query),
    estado: query.estado === 'TODOS' ? null : query.estado,
    responsableId: query.responsableId ?? null,
    tipo: query.tipo ?? null,
  };
}

/** Solo filtros: nunca filas ni datos de personas en `AuditLog.detalles`. */
function detallesAuditoria(filtro: FiltroReporteProcesos) {
  return {
    reporte: 'PROCESOS_JURIDICOS',
    ...detallesCartera(filtro),
    estado: filtro.estado ?? 'TODOS',
    responsableId: filtro.responsableId,
    tipo: filtro.tipo,
  };
}

function ultimoAvance(row: FilaProcesoRow): AvanceReporte | null {
  return row.ultimoAvanceEn
    ? {
        fecha: fechaCalendarioGT(row.ultimoAvanceEn),
        tipo: row.ultimoAvanceTipo ?? '',
        contenido: row.ultimoAvanceContenido ?? '',
      }
    : null;
}

/** Lugar, etnia y tipología con las mismas funciones que los reportes de población. */
export function aFilaReporte(row: FilaProcesoRow): FilaReporteJuridico {
  return {
    numero: row.numero,
    numeroInterno: etiquetaProceso(row.expedienteNumero, row.consecutivo),
    usuaria: `${row.nombres} ${row.apellidos}`,
    telefono: row.telefono,
    tipo: row.tipo,
    numeroJudicial: row.numeroJudicial,
    ultimoAvance: ultimoAvance(row),
    abogada: row.abogada,
    procuradora: row.procuradora,
    grupoEtnico: ETIQUETAS_GRUPO_ETNICO[row.grupoEtnico],
    edad: row.edad,
    tipologia: etiquetasTipologia(row.tipologias),
    procedencia: procedenciaParaReporte(row),
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

/** Columnas del Excel, en el orden que pidió Jurídico; la vista previa usa el mismo. */
export const COLUMNAS_PROCESOS: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'No. expediente', ancho: 20, tipo: 'texto' },
  { titulo: 'Nombre de la usuaria', ancho: 32, tipo: 'texto' },
  { titulo: 'Teléfono', ancho: 14, tipo: 'texto' },
  { titulo: 'Tipo de proceso', ancho: 34, tipo: 'texto' },
  { titulo: 'No. expediente juzgado', ancho: 40, tipo: 'texto' },
  { titulo: 'Avance en el trámite del proceso', ancho: 60, tipo: 'texto' },
  { titulo: 'Responsable', ancho: 36, tipo: 'texto' },
  { titulo: 'Etnia', ancho: 16, tipo: 'texto' },
  { titulo: 'Edad', ancho: 6, tipo: 'numero' },
  { titulo: 'Tipo de violencia', ancho: 28, tipo: 'texto' },
  { titulo: 'Procedencia', ancho: 36, tipo: 'texto' },
];

/** "20/10/2026 · Memorial de evacuación: se presentó…": fecha, tipo y lo que se escribió. */
export function textoAvance(avance: AvanceReporte | null): string {
  if (!avance) return '';
  const encabezado = `${formatFechaGT(avance.fecha)} · ${avance.tipo}`;
  return avance.contenido ? `${encabezado}: ${avance.contenido}` : encabezado;
}

/** "Ana López (abogada), Rosa Caal (procuradora)": quien esté asignada. */
export function textoResponsables(
  fila: Pick<FilaReporteJuridico, 'abogada' | 'procuradora'>,
): string {
  return [
    fila.abogada && `${fila.abogada} (abogada)`,
    fila.procuradora && `${fila.procuradora} (procuradora)`,
  ]
    .filter(Boolean)
    .join(', ');
}

export function aFilaHoja(fila: FilaReporteJuridico): ValorCeldaHoja[] {
  return [
    fila.numero,
    fila.numeroInterno,
    fila.usuaria,
    fila.telefono ?? '',
    ETIQUETAS_TIPO_PROCESO_JURIDICO[fila.tipo],
    fila.numeroJudicial ?? '',
    textoAvance(fila.ultimoAvance),
    textoResponsables(fila),
    fila.grupoEtnico,
    fila.edad,
    fila.tipologia,
    fila.procedencia,
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
  ) {}

  async vistaPrevia(
    query: ReporteProcesosJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ReporteProcesosJuridico> {
    const filtro = aFiltro(query);
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
      vistaPrevia: filas.map(aFilaReporte),
    };
  }

  async exportar(
    query: ReporteProcesosJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const filtro = aFiltro(query);
    const filas = await this.repositorio.filas(filtro, null);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Procesos jurídicos',
      columnas: COLUMNAS_PROCESOS,
      filas: filas.map((fila) => aFilaHoja(aFilaReporte(fila))),
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
      nombreArchivo: `procesos-juridicos_${sufijoArchivo(filtro)}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }
}
