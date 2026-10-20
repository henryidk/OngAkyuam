import { Inject, Injectable } from '@nestjs/common';
import {
  anioCalendarioGT,
  calcularRangoEdad,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_RANGO_EDAD,
  etiquetasTipologia,
  fechaCalendarioGT,
  FILAS_VISTA_PREVIA_REPORTE,
  lugarParaReporte,
  type FilaPoblacionJuridico,
  type ReportePoblacionJuridico,
  type ReportePoblacionJuridicoQuery,
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
import { REPORTE_POBLACION_JURIDICO_REPOSITORY } from '../interfaces/reporte-poblacion-juridico-repository.interface';
import type {
  FilaPoblacionJuridicoRow,
  FiltroReportePoblacionJuridico,
  IReportePoblacionJuridicoRepository,
} from '../interfaces/reporte-poblacion-juridico-repository.interface';
import {
  aFiltroCartera,
  detallesCartera,
  sufijoArchivo,
  type ArchivoReporte,
} from './cartera-reporte';

/** Solo filtros: nunca filas ni datos de personas en `AuditLog.detalles`. */
function detallesAuditoria(filtro: FiltroReportePoblacionJuridico) {
  return { reporte: 'POBLACION_JURIDICO', ...detallesCartera(filtro) };
}

/** Lugar y tipología con las mismas funciones que el reporte de Trabajo Social. */
export function aFilaPoblacionJuridico(
  row: FilaPoblacionJuridicoRow,
): FilaPoblacionJuridico {
  return {
    numero: row.numero,
    dia: row.dia,
    ...lugarParaReporte(row),
    numeroCaso: row.numeroCaso,
    fechaNacimiento: row.fechaNacimiento,
    edad: row.edad,
    nombreApellido: `${row.nombres} ${row.apellidos}`,
    dpi: row.dpi,
    rangoEdad: ETIQUETAS_RANGO_EDAD[calcularRangoEdad(row.edad)],
    grupoEtnico: ETIQUETAS_GRUPO_ETNICO[row.grupoEtnico],
    ubicacionGeografica: row.ubicacionGeografica ?? '',
    tipologia: etiquetasTipologia(row.tipologias),
  };
}

/** Las 13 columnas del formato "Población beneficiada" de la ONG, en su orden (§8.6, A). */
export const COLUMNAS_POBLACION_JURIDICO: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'Día', ancho: 12, tipo: 'fecha' },
  { titulo: 'Departamento', ancho: 16, tipo: 'texto' },
  { titulo: 'Municipio', ancho: 22, tipo: 'texto' },
  { titulo: 'No. de caso', ancho: 12, tipo: 'texto' },
  { titulo: 'Fecha de nacimiento', ancho: 14, tipo: 'fecha' },
  { titulo: 'Edad', ancho: 6, tipo: 'numero' },
  { titulo: 'Nombre y apellido', ancho: 32, tipo: 'texto' },
  { titulo: 'DPI', ancho: 16, tipo: 'texto' },
  { titulo: 'Rango de edad', ancho: 16, tipo: 'texto' },
  { titulo: 'Grupo étnico', ancho: 16, tipo: 'texto' },
  { titulo: 'Ubicación geográfica', ancho: 24, tipo: 'texto' },
  { titulo: 'Tipología del delito', ancho: 28, tipo: 'texto' },
];

export function aFilaHojaPoblacion(
  fila: FilaPoblacionJuridico,
): ValorCeldaHoja[] {
  return [
    fila.numero,
    fila.dia,
    fila.departamento,
    fila.municipio,
    fila.numeroCaso,
    fila.fechaNacimiento,
    fila.edad,
    fila.nombreApellido,
    // Texto, no número: un DPI de 13 dígitos se mostraría en notación científica.
    fila.dpi ?? '',
    fila.rangoEdad,
    fila.grupoEtnico,
    fila.ubicacionGeografica,
    fila.tipologia,
  ];
}

@Injectable()
export class ReportePoblacionJuridicoService {
  constructor(
    @Inject(REPORTE_POBLACION_JURIDICO_REPOSITORY)
    private readonly repositorio: IReportePoblacionJuridicoRepository,
    @Inject(EXPORTADOR_HOJA_CALCULO)
    private readonly exportador: IExportadorHojaCalculo,
    private readonly auditService: AuditService,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  async vistaPrevia(
    query: ReportePoblacionJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ReportePoblacionJuridico> {
    const filtro = this.aFiltro(query);
    const [filas, totales] = await Promise.all([
      this.repositorio.filas(filtro, FILAS_VISTA_PREVIA_REPORTE),
      this.repositorio.totales(filtro),
    ]);

    // La vista previa muestra nombres y DPI: se audita igual que el reporte de TS.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_CONSULTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: detallesAuditoria(filtro),
    });

    return { totales, vistaPrevia: filas.map(aFilaPoblacionJuridico) };
  }

  async exportar(
    query: ReportePoblacionJuridicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const filtro = this.aFiltro(query);
    const filas = await this.repositorio.filas(filtro, null);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Población beneficiada',
      columnas: COLUMNAS_POBLACION_JURIDICO,
      filas: filas.map((fila) =>
        aFilaHojaPoblacion(aFilaPoblacionJuridico(fila)),
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

    const ahora = this.reloj.ahora();
    return {
      contenido,
      nombreArchivo: `poblacion-beneficiada-juridico_${sufijoArchivo(filtro, fechaCalendarioGT(ahora))}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }

  /** El año en curso es el de Guatemala: separa la cartera del año de la de seguimiento. */
  private aFiltro(
    query: ReportePoblacionJuridicoQuery,
  ): FiltroReportePoblacionJuridico {
    return aFiltroCartera(query, anioCalendarioGT(this.reloj.ahora()));
  }
}
