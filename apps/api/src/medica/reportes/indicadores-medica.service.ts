import { Inject, Injectable } from '@nestjs/common';
import {
  anioActualGT,
  anioCalendarioGT,
  aniosEntre,
  finMesGT,
  inicioMesGT,
  nombreMesGT,
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
import { cifraAnonima, resumirAnio } from '../dominio/indicadores';
import {
  REPORTES_MEDICA_REPOSITORY,
  type IReportesMedicaRepository,
} from '../interfaces/reportes-medica-repository.interface';

export interface ArchivoReporteMedica {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

const COLUMNAS: ColumnaHoja[] = [
  { titulo: 'Indicador', ancho: 26, tipo: 'texto' },
  { titulo: 'Categoría', ancho: 34, tipo: 'texto' },
  ...MESES.map((mes): ColumnaHoja => ({
    titulo: nombreMesGT(mes).slice(0, 3),
    ancho: 7,
    tipo: 'numero',
  })),
  { titulo: 'Año', ancho: 8, tipo: 'numero' },
];

const DESGLOSES: { clave: keyof PeriodoMedica['desgloses']; titulo: string }[] =
  [
    { clave: 'rangoEdad', titulo: 'Personas por rango de edad' },
    { clave: 'grupoEtnico', titulo: 'Personas por grupo étnico' },
    { clave: 'tipologia', titulo: 'Personas por tipología 22-2008' },
    { clave: 'municipio', titulo: 'Personas por municipio' },
  ];

/**
 * Indicadores de Medicina: solo cifras agregadas, nunca filas por persona. Una sola consulta
 * de las consultas del año, agregada en memoria por el dominio.
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
    const [consultas, enAtencionAhora, primera] = await Promise.all([
      this.reportesRepository.consultasEntre(
        inicioMesGT(query.anio, 1),
        finMesGT(query.anio, 12),
      ),
      this.reportesRepository.contarActivas(),
      this.reportesRepository.primeraConsulta(),
    ]);
    const anioActual = anioActualGT();
    await this.auditService.registrar(
      eventoReporte(contexto, 'INDICADORES_MEDICA_CONSULTADOS', query.anio),
    );
    return {
      anio: query.anio,
      aniosDisponibles: aniosEntre(
        primera ? anioCalendarioGT(primera) : anioActual,
        anioActual,
      ),
      enAtencionAhora,
      ...resumirAnio(consultas),
    };
  }

  /** Excel de agregados: una fila por indicador, columnas por mes, cifras pequeñas como "<3". */
  async exportar(
    query: ReportesMedicaQuery,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporteMedica> {
    const { anual, meses } = resumirAnio(
      await this.reportesRepository.consultasEntre(
        inicioMesGT(query.anio, 1),
        finMesGT(query.anio, 12),
      ),
    );

    const fila = (
      indicador: string,
      categoria: string,
      valor: (periodo: PeriodoMedica) => number,
    ): ValorCeldaHoja[] => [
      indicador,
      categoria,
      ...meses.map((mes) => cifraAnonima(valor(mes))),
      cifraAnonima(valor(anual)),
    ];

    const filas: ValorCeldaHoja[][] = [
      fila('Consultas', 'Total', (p) => p.consultas),
      fila('Primeras consultas', 'Total', (p) => p.primerasConsultas),
      fila('Personas atendidas', 'Total', (p) => p.personasAtendidas),
    ];
    for (const { clave, titulo } of DESGLOSES) {
      for (const [indice, conteo] of anual.desgloses[clave].entries()) {
        filas.push(
          fila(titulo, conteo.etiqueta, (p) =>
            totalDe(p.desgloses[clave], indice),
          ),
        );
      }
    }

    const contenido = await this.exportador.generar({
      nombreHoja: `Medicina ${query.anio}`,
      columnas: COLUMNAS,
      filas,
    });
    await this.auditService.registrar(
      eventoReporte(contexto, 'REPORTE_MEDICA_EXPORTADO', query.anio),
    );
    return {
      contenido,
      nombreArchivo: `medicina-indicadores_${query.anio}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }
}

/** Los desgloses siempre traen todas las claves en el mismo orden. */
function totalDe(conteos: readonly ConteoReporte[], indice: number): number {
  return conteos[indice]?.total ?? 0;
}

/** Un reporte no es de una entidad: solo el año, nunca datos de una persona. */
function eventoReporte(
  contexto: ContextoAuditoria,
  accion: string,
  anio: number,
): RegistrarAuditoriaParams {
  return {
    usuarioId: contexto.usuarioId,
    username: contexto.username,
    ipAddress: contexto.ipAddress,
    userAgent: contexto.userAgent,
    accion,
    entidad: 'Reporte',
    detalles: { anio },
  };
}
