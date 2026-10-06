import { Inject, Injectable } from '@nestjs/common';
import {
  calcularRangoEdad,
  CATEGORIA_POR_TIPO_PROCESO,
  CATEGORIAS_PROCESO_JURIDICO,
  ESTADOS_VISIBLES_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_ESTADO_VISIBLE,
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  FILAS_VISTA_PREVIA_REPORTE,
  FORMAS_FINALIZACION_PROCESO,
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
import { codigoProceso } from '../dominio/codigo-proceso';
import { REPORTE_PROCESOS_REPOSITORY } from '../interfaces/reporte-procesos-repository.interface';
import type {
  ConteoProcesosRow,
  FilaProcesoRow,
  FiltroReporteProcesos,
  IReporteProcesosRepository,
} from '../interfaces/reporte-procesos-repository.interface';

export interface ArchivoReporte {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

function aFiltro(query: ReporteProcesosJuridicoQuery): FiltroReporteProcesos {
  return {
    desde: query.desde,
    hasta: query.hasta,
    estado: query.estado === 'TODOS' ? null : query.estado,
    abogadaId: query.abogadaId ?? null,
  };
}

/** Solo filtros: nunca filas ni datos de personas en `AuditLog.detalles`. */
function detallesAuditoria(query: ReporteProcesosJuridicoQuery) {
  return {
    reporte: 'PROCESOS_JURIDICOS',
    desde: query.desde,
    hasta: query.hasta,
    estado: query.estado,
    abogadaId: query.abogadaId ?? null,
  };
}

export function aFilaReporte(row: FilaProcesoRow): FilaReporteJuridico {
  // La forma y la fecha de cierre solo describen un proceso finalizado.
  const finalizado = row.estado === 'FINALIZADO';
  return {
    numero: row.numero,
    codigo: codigoProceso(row.consecutivo, row.expedienteNumero),
    numeroJudicial: row.numeroJudicial,
    fechaInicio: row.fechaInicio,
    usuaria: `${row.nombres} ${row.apellidos}`,
    edad: row.edad,
    rangoEdad: ETIQUETAS_RANGO_EDAD[calcularRangoEdad(row.edad)],
    grupoEtnico: ETIQUETAS_GRUPO_ETNICO[row.grupoEtnico],
    municipio: row.municipio
      ? ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[row.municipio]
      : (row.municipioOtro ?? ''),
    tipo: row.tipo,
    abogada: row.abogada,
    estado: row.estado,
    formaFinalizacion: finalizado ? row.formaFinalizacion : null,
    fechaCierre: finalizado ? row.fechaCierre : null,
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

/** Columnas del Excel, en el mismo orden que la vista previa. */
export const COLUMNAS_PROCESOS: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'No. interno', ancho: 14, tipo: 'texto' },
  { titulo: 'No. judicial', ancho: 20, tipo: 'texto' },
  { titulo: 'Fecha de inicio', ancho: 12, tipo: 'fecha' },
  { titulo: 'Usuaria', ancho: 32, tipo: 'texto' },
  { titulo: 'Edad', ancho: 6, tipo: 'numero' },
  { titulo: 'Rango de edad', ancho: 16, tipo: 'texto' },
  { titulo: 'Grupo étnico', ancho: 16, tipo: 'texto' },
  { titulo: 'Municipio', ancho: 22, tipo: 'texto' },
  { titulo: 'Tipo de proceso', ancho: 34, tipo: 'texto' },
  { titulo: 'Abogada', ancho: 26, tipo: 'texto' },
  { titulo: 'Estado', ancho: 12, tipo: 'texto' },
  { titulo: 'Forma de finalización', ancho: 16, tipo: 'texto' },
  { titulo: 'Fecha de cierre', ancho: 12, tipo: 'fecha' },
];

export function aFilaHoja(fila: FilaReporteJuridico): ValorCeldaHoja[] {
  return [
    fila.numero,
    fila.codigo,
    fila.numeroJudicial ?? '',
    fila.fechaInicio,
    fila.usuaria,
    fila.edad,
    fila.rangoEdad,
    fila.grupoEtnico,
    fila.municipio,
    ETIQUETAS_TIPO_PROCESO_JURIDICO[fila.tipo],
    fila.abogada ?? '',
    ETIQUETAS_ESTADO_VISIBLE[fila.estado],
    fila.formaFinalizacion
      ? ETIQUETAS_FORMA_FINALIZACION[fila.formaFinalizacion]
      : '',
    fila.fechaCierre,
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
    const [filas, conteos, usuarias] = await Promise.all([
      this.repositorio.filas(filtro, FILAS_VISTA_PREVIA_REPORTE),
      this.repositorio.conteos(filtro),
      this.repositorio.usuariasDistintas(filtro),
    ]);

    // La vista previa muestra nombres de usuarias: se audita igual que el reporte de TS.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_CONSULTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: detallesAuditoria(query),
    });

    return {
      totales: {
        procesos: conteos.reduce((suma, conteo) => suma + conteo.total, 0),
        usuarias,
      },
      desgloses: armarDesgloses(conteos),
      vistaPrevia: filas.map(aFilaReporte),
    };
  }

  async exportar(
    query: ReporteProcesosJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const filas = await this.repositorio.filas(aFiltro(query), null);
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
      detalles: { ...detallesAuditoria(query), filas: filas.length },
    });

    return {
      contenido,
      // Solo el rango de fechas en el nombre: nunca datos de una persona.
      nombreArchivo: `procesos-juridicos_${query.desde}_${query.hasta}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }
}
