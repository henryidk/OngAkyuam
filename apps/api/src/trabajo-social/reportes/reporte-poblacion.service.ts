import { Inject, Injectable } from '@nestjs/common';
import {
  calcularRangoEdad,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPOLOGIA_DELITO,
  FILAS_VISTA_PREVIA_REPORTE,
  GRUPOS_ETNICOS,
  TIPOLOGIAS_DELITO,
  ETIQUETAS_CORTAS_TIPO_REGISTRO,
  type ConteoReporte,
  type FilaPoblacionBeneficiada,
  type RangoEdad,
  type ReportePoblacionBeneficiada,
  type ReportePoblacionQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { EXPORTADOR_HOJA_CALCULO } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  ColumnaHoja,
  IExportadorHojaCalculo,
  ValorCeldaHoja,
} from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import { REPORTE_POBLACION_REPOSITORY } from './interfaces/reporte-poblacion-repository.interface';
import type {
  ConteoDemograficoRow,
  ConteoTipologiaRow,
  FiltroReportePoblacion,
  FilaPoblacionRow,
  IReportePoblacionRepository,
} from './interfaces/reporte-poblacion-repository.interface';

const DEPARTAMENTO_ALTA_VERAPAZ = 'Alta Verapaz';
const RANGOS_EDAD = Object.keys(ETIQUETAS_RANGO_EDAD) as RangoEdad[];

export interface ArchivoReporte {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

function aFiltro(query: ReportePoblacionQuery): FiltroReportePoblacion {
  return {
    desde: query.desde,
    hasta: query.hasta,
    tipoRegistro: query.tipoRegistro === 'TODOS' ? null : query.tipoRegistro,
    incluirNinos: query.incluirNinos,
  };
}

/** Solo filtros: nunca filas ni datos de personas en `AuditLog.detalles` (plan §6). */
function detallesAuditoria(query: ReportePoblacionQuery) {
  return {
    reporte: 'POBLACION_BENEFICIADA',
    desde: query.desde,
    hasta: query.hasta,
    tipoRegistro: query.tipoRegistro,
    incluirNinos: query.incluirNinos,
  };
}

/**
 * Traduce una persona del reporte a las columnas del Excel de Trabajo Social. Fuera de Alta
 * Verapaz, departamento y municipio son los que se escribieron a mano en el registro.
 */
export function aFilaPoblacion(
  row: FilaPoblacionRow,
): FilaPoblacionBeneficiada {
  const enAltaVerapaz = row.municipio !== null;
  const esHija = row.generoNino === 'MUJER';
  return {
    numero: row.numero,
    fecha: row.fecha,
    departamento: enAltaVerapaz
      ? DEPARTAMENTO_ALTA_VERAPAZ
      : (row.departamentoOtro ?? ''),
    municipio: row.municipio
      ? ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[row.municipio]
      : (row.municipioOtro ?? ''),
    numeroCaso: row.numeroCaso,
    fechaNacimiento: row.fechaNacimiento,
    edad: row.edad,
    rangoEdad: ETIQUETAS_RANGO_EDAD[calcularRangoEdad(row.edad)],
    nombresApellidos: `${row.nombres} ${row.apellidos}`,
    dpi: row.dpi,
    genero: row.esUsuaria ? 'Mujer' : esHija ? 'Niña' : 'Niño',
    grupoEtnico: ETIQUETAS_GRUPO_ETNICO[row.grupoEtnico],
    ubicacionGeografica: row.ubicacionGeografica ?? '',
    // La tipología describe la violencia que vivió la usuaria: no se repite en sus hijas/hijos.
    tipologia: row.esUsuaria
      ? row.tipologias.map((t) => ETIQUETAS_TIPOLOGIA_DELITO[t]).join(', ')
      : '',
    registro: row.tipoRegistro,
    relacion: row.esUsuaria
      ? 'Usuaria'
      : `${esHija ? 'Hija' : 'Hijo'} de ${row.numeroCaso}`,
    esUsuaria: row.esUsuaria,
  };
}

/** Totales y desgloses a partir de los conteos que ya vienen agrupados desde SQL. */
export function armarDesgloses(
  demograficos: ConteoDemograficoRow[],
  tipologias: ConteoTipologiaRow[],
): Pick<ReportePoblacionBeneficiada, 'totales' | 'desgloses'> {
  const porRango = new Map<RangoEdad, number>();
  const porGrupo = new Map<string, number>();
  let usuarias = 0;
  let ninos = 0;

  for (const conteo of demograficos) {
    const rango = calcularRangoEdad(conteo.edad);
    porRango.set(rango, (porRango.get(rango) ?? 0) + conteo.total);
    porGrupo.set(
      conteo.grupoEtnico,
      (porGrupo.get(conteo.grupoEtnico) ?? 0) + conteo.total,
    );
    if (conteo.esUsuaria) {
      usuarias += conteo.total;
    } else {
      ninos += conteo.total;
    }
  }

  const porTipologia = new Map<string, number>(
    tipologias.map((t) => [t.tipologia, t.total]),
  );

  // Todas las categorías del catálogo, aunque tengan 0: así las barras no cambian de lugar
  // de un periodo a otro.
  const rangoEdad: ConteoReporte[] = RANGOS_EDAD.map((clave) => ({
    clave,
    etiqueta: ETIQUETAS_RANGO_EDAD[clave],
    total: porRango.get(clave) ?? 0,
  }));
  const grupoEtnico: ConteoReporte[] = GRUPOS_ETNICOS.map((clave) => ({
    clave,
    etiqueta: ETIQUETAS_GRUPO_ETNICO[clave],
    total: porGrupo.get(clave) ?? 0,
  }));
  const tipologia: ConteoReporte[] = TIPOLOGIAS_DELITO.map((clave) => ({
    clave,
    etiqueta: ETIQUETAS_TIPOLOGIA_DELITO[clave],
    total: porTipologia.get(clave) ?? 0,
  }));

  return {
    totales: { personas: usuarias + ninos, usuarias, ninos },
    desgloses: { rangoEdad, grupoEtnico, tipologia },
  };
}

/** Columnas en el mismo orden que el Excel que usa hoy Trabajo Social (plan §3.8). */
export const COLUMNAS_POBLACION: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'Fecha', ancho: 12, tipo: 'fecha' },
  { titulo: 'Departamento', ancho: 16, tipo: 'texto' },
  { titulo: 'Municipio', ancho: 22, tipo: 'texto' },
  { titulo: 'No. de caso', ancho: 12, tipo: 'texto' },
  { titulo: 'Fecha de nacimiento', ancho: 14, tipo: 'fecha' },
  { titulo: 'Edad', ancho: 6, tipo: 'numero' },
  { titulo: 'Rango de edad', ancho: 16, tipo: 'texto' },
  { titulo: 'Nombres y apellidos', ancho: 32, tipo: 'texto' },
  { titulo: 'DPI', ancho: 16, tipo: 'texto' },
  { titulo: 'Género', ancho: 8, tipo: 'texto' },
  { titulo: 'Grupo étnico', ancho: 16, tipo: 'texto' },
  { titulo: 'Ubicación geográfica', ancho: 24, tipo: 'texto' },
  { titulo: 'Tipología 22-2008', ancho: 28, tipo: 'texto' },
  { titulo: 'Registro', ancho: 10, tipo: 'texto' },
  { titulo: 'Relación', ancho: 16, tipo: 'texto' },
];

export function aFilaHoja(fila: FilaPoblacionBeneficiada): ValorCeldaHoja[] {
  return [
    fila.numero,
    fila.fecha,
    fila.departamento,
    fila.municipio,
    fila.numeroCaso,
    fila.fechaNacimiento,
    fila.edad,
    fila.rangoEdad,
    fila.nombresApellidos,
    // Texto, no número: un DPI de 13 dígitos se mostraría en notación científica.
    fila.dpi,
    fila.genero,
    fila.grupoEtnico,
    fila.ubicacionGeografica,
    fila.tipologia,
    ETIQUETAS_CORTAS_TIPO_REGISTRO[fila.registro],
    fila.relacion,
  ];
}

@Injectable()
export class ReportePoblacionService {
  constructor(
    @Inject(REPORTE_POBLACION_REPOSITORY)
    private readonly repositorio: IReportePoblacionRepository,
    @Inject(EXPORTADOR_HOJA_CALCULO)
    private readonly exportador: IExportadorHojaCalculo,
    private readonly auditService: AuditService,
  ) {}

  async vistaPrevia(
    query: ReportePoblacionQuery,
    contexto: ContextoAuditoria,
  ): Promise<ReportePoblacionBeneficiada> {
    const filtro = aFiltro(query);
    const [filas, demograficos, tipologias] = await Promise.all([
      this.repositorio.filas(filtro, FILAS_VISTA_PREVIA_REPORTE),
      this.repositorio.conteosDemograficos(filtro),
      this.repositorio.conteosTipologia(filtro),
    ]);

    // La vista previa muestra nombres y DPI: se audita igual que la lista de Usuarias.
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
      ...armarDesgloses(demograficos, tipologias),
      vistaPrevia: filas.map(aFilaPoblacion),
    };
  }

  async exportar(
    query: ReportePoblacionQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const filas = await this.repositorio.filas(aFiltro(query), null);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Población beneficiada',
      columnas: COLUMNAS_POBLACION,
      filas: filas.map((fila) => aFilaHoja(aFilaPoblacion(fila))),
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_EXPORTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { ...detallesAuditoria(query), filas: filas.length },
    });

    return {
      contenido,
      // Solo el rango de fechas en el nombre: nunca datos de una persona.
      nombreArchivo: `poblacion-beneficiada_${query.desde}_${query.hasta}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }
}
