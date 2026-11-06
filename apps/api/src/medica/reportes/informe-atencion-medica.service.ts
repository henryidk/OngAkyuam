import { Inject, Injectable } from '@nestjs/common';
import {
  ETIQUETAS_FILA_INFORME_ATENCION_MEDICA,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_RANGO_EDAD_INFORME_MEDICA,
  finDiaGT,
  GRUPOS_ETNICOS,
  inicioDiaGT,
  RANGOS_EDAD_INFORME_MEDICA,
  type CifrasInformeAtencionMedica,
  type InformeAtencionMedica,
  type InformeAtencionMedicaQuery,
} from '@akyuam/shared';
import {
  AuditService,
  type RegistrarAuditoriaParams,
} from '../../auth/services/audit.service';
import {
  EXPORTADOR_HOJA_CALCULO,
  type ColumnaHoja,
  type IExportadorHojaCalculo,
  type ValorCeldaHoja,
} from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { armarInformeAtencion } from '../dominio/informe-atencion';
import {
  REPORTES_MEDICA_REPOSITORY,
  type IReportesMedicaRepository,
} from '../interfaces/reportes-medica-repository.interface';
import type { ArchivoReporteMedica } from './indicadores-medica.service';

const GRUPO_TOTAL = 'Total';
const GRUPO_ETNIA = 'Pertenencia étnica';
const GRUPO_EDAD = 'Datos etarios (años)';

/** Mismo orden y encabezados que el formato que entregó la ONG. */
const COLUMNAS: ColumnaHoja[] = [
  { titulo: 'Atención', ancho: 48, tipo: 'texto' },
  { titulo: 'Mujer / Femenino', ancho: 11, tipo: 'numero', grupo: GRUPO_TOTAL },
  {
    titulo: 'Hombre / Masculino',
    ancho: 11,
    tipo: 'numero',
    grupo: GRUPO_TOTAL,
  },
  ...GRUPOS_ETNICOS.map((grupo): ColumnaHoja => ({
    titulo: ETIQUETAS_GRUPO_ETNICO[grupo],
    ancho: 10,
    tipo: 'numero',
    grupo: GRUPO_ETNIA,
  })),
  ...RANGOS_EDAD_INFORME_MEDICA.map((rango): ColumnaHoja => ({
    titulo: ETIQUETAS_RANGO_EDAD_INFORME_MEDICA[rango],
    ancho: 9,
    tipo: 'numero',
    grupo: GRUPO_EDAD,
  })),
  { titulo: 'TOTAL', ancho: 9, tipo: 'numero' },
];

function celdas(
  etiqueta: string,
  cifras: CifrasInformeAtencionMedica,
): ValorCeldaHoja[] {
  return [
    etiqueta,
    cifras.mujer,
    cifras.hombre,
    ...GRUPOS_ETNICOS.map((grupo) => cifras.etnia[grupo]),
    ...RANGOS_EDAD_INFORME_MEDICA.map((rango) => cifras.edad[rango]),
    cifras.total,
  ];
}

/**
 * Informe de atención de Medicina con el formato de la ONG: solo cifras agregadas, nunca filas
 * por persona. Cifras reales (sin "<3"): el formato es para la rendición de cuentas de la ONG.
 */
@Injectable()
export class InformeAtencionMedicaService {
  constructor(
    @Inject(REPORTES_MEDICA_REPOSITORY)
    private readonly reportesRepository: IReportesMedicaRepository,
    @Inject(EXPORTADOR_HOJA_CALCULO)
    private readonly exportador: IExportadorHojaCalculo,
    private readonly auditService: AuditService,
  ) {}

  async obtener(
    query: InformeAtencionMedicaQuery,
    contexto: ContextoAuditoria,
  ): Promise<InformeAtencionMedica> {
    const informe = await this.armar(query);
    await this.auditService.registrar(
      evento(contexto, 'INFORME_ATENCION_MEDICA_CONSULTADO', query),
    );
    return informe;
  }

  async exportar(
    query: InformeAtencionMedicaQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporteMedica> {
    const informe = await this.armar(query);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Atención médica',
      columnas: COLUMNAS,
      filas: [
        ...informe.filas.map((fila) =>
          celdas(ETIQUETAS_FILA_INFORME_ATENCION_MEDICA[fila.clave], fila),
        ),
        celdas('TOTALES', informe.totales),
      ],
    });
    await this.auditService.registrar(
      evento(contexto, 'INFORME_ATENCION_MEDICA_EXPORTADO', query),
    );
    return {
      contenido,
      nombreArchivo: `medicina-atencion_${query.desde}_${query.hasta}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }

  private async armar(
    query: InformeAtencionMedicaQuery,
  ): Promise<InformeAtencionMedica> {
    const consultas = await this.reportesRepository.consultasParaInforme(
      inicioDiaGT(query.desde),
      finDiaGT(query.hasta),
    );
    return {
      desde: query.desde,
      hasta: query.hasta,
      ...armarInformeAtencion(consultas),
    };
  }
}

/** Un reporte no es de una entidad: solo el periodo, nunca datos de una persona. */
function evento(
  contexto: ContextoAuditoria,
  accion: string,
  query: InformeAtencionMedicaQuery,
): RegistrarAuditoriaParams {
  return {
    usuarioId: contexto.usuarioId,
    username: contexto.username,
    ipAddress: contexto.ipAddress,
    userAgent: contexto.userAgent,
    accion,
    entidad: 'Reporte',
    detalles: {
      reporte: 'ATENCION_MEDICA',
      desde: query.desde,
      hasta: query.hasta,
    },
  };
}
