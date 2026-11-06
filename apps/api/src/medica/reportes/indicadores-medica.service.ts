import { Inject, Injectable } from '@nestjs/common';
import {
  ETIQUETAS_ALCANCE_REPORTE_MEDICA,
  ETIQUETAS_PERSONA_REPORTE_MEDICA,
  finDiaGT,
  formatFechaGT,
  inicioDiaGT,
  nombreMesGT,
  UMBRAL_ANONIMATO,
} from '@akyuam/shared';
import type {
  ConteoReporte,
  IndicadoresMedica,
  PeriodoMedica,
  ReportesMedicaQuery,
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
import {
  cifraAnonima,
  filtrarConsultas,
  resumirRango,
} from '../dominio/indicadores';
import {
  REPORTES_MEDICA_REPOSITORY,
  type IReportesMedicaRepository,
} from '../interfaces/reportes-medica-repository.interface';

export interface ArchivoReporteMedica {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

const DESGLOSES: { clave: keyof PeriodoMedica['desgloses']; titulo: string }[] =
  [
    { clave: 'rangoEdad', titulo: 'Personas por rango de edad' },
    { clave: 'grupoEtnico', titulo: 'Personas por grupo étnico' },
    { clave: 'tipologia', titulo: 'Personas por tipología 22-2008' },
    { clave: 'municipio', titulo: 'Personas por municipio' },
  ];

/**
 * Indicadores de Medicina: solo cifras agregadas, nunca filas por persona. La pantalla y el
 * Excel salen del mismo cálculo, con el mismo periodo y los mismos filtros.
 */
@Injectable()
export class IndicadoresMedicaService {
  constructor(
    @Inject(REPORTES_MEDICA_REPOSITORY)
    private readonly reportesRepository: IReportesMedicaRepository,
    @Inject(EXPORTADOR_HOJA_CALCULO)
    private readonly exportador: IExportadorHojaCalculo,
    private readonly auditService: AuditService,
  ) {}

  async obtener(
    query: ReportesMedicaQuery,
    contexto: ContextoAuditoria,
  ): Promise<IndicadoresMedica> {
    const [resumen, enAtencionAhora] = await Promise.all([
      this.resumir(query, contexto),
      this.reportesRepository.contarActivas(),
    ]);
    await this.auditService.registrar(
      eventoReporte(contexto, 'INDICADORES_MEDICA_CONSULTADOS', query),
    );
    return {
      desde: query.desde,
      hasta: query.hasta,
      enAtencionAhora,
      ...resumen,
    };
  }

  /**
   * Excel de agregados: una fila por indicador, una columna por mes del periodo y el total.
   * Al pie, el periodo y los filtros con que se generó, para que el archivo se entienda solo.
   */
  async exportar(
    query: ReportesMedicaQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporteMedica> {
    const { total, meses } = await this.resumir(query, contexto);
    const variosAnios = meses.some((mes) => mes.anio !== meses[0].anio);

    const columnas: ColumnaHoja[] = [
      { titulo: 'Indicador', ancho: 30, tipo: 'texto' },
      { titulo: 'Categoría', ancho: 38, tipo: 'texto' },
      ...meses.map(({ anio, mes }): ColumnaHoja => ({
        titulo: `${nombreMesGT(mes).slice(0, 3)}${variosAnios ? ` ${anio}` : ''}`,
        ancho: variosAnios ? 10 : 7,
        tipo: 'numero',
      })),
      { titulo: 'Total', ancho: 8, tipo: 'numero' },
    ];

    const fila = (
      indicador: string,
      categoria: string,
      valor: (periodo: PeriodoMedica) => number,
    ): ValorCeldaHoja[] => [
      indicador,
      categoria,
      ...meses.map((mes) => cifraAnonima(valor(mes))),
      cifraAnonima(valor(total)),
    ];

    const filas: ValorCeldaHoja[][] = [
      fila('Consultas', 'Total', (p) => p.consultas),
      fila('Primeras consultas', 'Total', (p) => p.primerasConsultas),
      fila('Personas atendidas', 'Total', (p) => p.personasAtendidas),
    ];
    for (const { clave, titulo } of DESGLOSES) {
      for (const [indice, conteo] of total.desgloses[clave].entries()) {
        filas.push(
          fila(titulo, conteo.etiqueta, (p) =>
            totalDe(p.desgloses[clave], indice),
          ),
        );
      }
    }
    filas.push(
      [],
      [
        'Periodo',
        `Del ${formatFechaGT(query.desde)} al ${formatFechaGT(query.hasta)}`,
      ],
      ['Personas', ETIQUETAS_PERSONA_REPORTE_MEDICA[query.persona]],
      [
        'Personal',
        query.alcance === 'MIAS'
          ? `Consultas registradas por ${contexto.username}`
          : ETIQUETAS_ALCANCE_REPORTE_MEDICA.TODO,
      ],
      [
        'Tipo de consulta',
        query.soloPrimeras ? 'Solo primeras consultas' : 'Todas las consultas',
      ],
      [
        'Nota',
        `Las cifras menores de ${UMBRAL_ANONIMATO} se muestran como "<${UMBRAL_ANONIMATO}" para no identificar a nadie.`,
      ],
    );

    const contenido = await this.exportador.generar({
      nombreHoja: 'Medicina',
      columnas,
      filas,
    });
    await this.auditService.registrar(
      eventoReporte(contexto, 'REPORTE_MEDICA_EXPORTADO', query),
    );
    return {
      contenido,
      nombreArchivo: `medicina-indicadores_${query.desde}_${query.hasta}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }

  /** "Mis consultas" se resuelve con la sesión, nunca con un id que mande el navegador. */
  private async resumir(
    query: ReportesMedicaQuery,
    contexto: ContextoAuditoria,
  ) {
    const consultas = await this.reportesRepository.consultasEntre(
      inicioDiaGT(query.desde),
      finDiaGT(query.hasta),
      query.alcance === 'MIAS' ? contexto.usuarioId : undefined,
    );
    return resumirRango(
      filtrarConsultas(consultas, query),
      query.desde,
      query.hasta,
    );
  }
}

/** Los desgloses siempre traen todas las claves en el mismo orden. */
function totalDe(conteos: readonly ConteoReporte[], indice: number): number {
  return conteos[indice]?.total ?? 0;
}

/** Un reporte no es de una entidad: solo el periodo y los filtros, nunca datos de una persona. */
function eventoReporte(
  contexto: ContextoAuditoria,
  accion: string,
  query: ReportesMedicaQuery,
): RegistrarAuditoriaParams {
  return {
    usuarioId: contexto.usuarioId,
    username: contexto.username,
    ipAddress: contexto.ipAddress,
    userAgent: contexto.userAgent,
    accion,
    entidad: 'Reporte',
    detalles: {
      desde: query.desde,
      hasta: query.hasta,
      persona: query.persona,
      alcance: query.alcance,
      soloPrimeras: query.soloPrimeras,
    },
  };
}
