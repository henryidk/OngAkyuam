import { Inject, Injectable } from '@nestjs/common';
import {
  anioActualGT,
  anioCalendarioGT,
  aniosEntre,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPOLOGIA_DELITO,
  finMesGT,
  inicioMesGT,
  type IndicadoresPsicologia,
  type IndicadoresQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { EXPORTADOR_HOJA_CALCULO } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  ColumnaHoja,
  IExportadorHojaCalculo,
  ValorCeldaHoja,
} from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import {
  MUNICIPIO_FUERA,
  personasAtendidas,
  resumirAnio,
  type PersonaAtendida,
} from '../dominio/indicadores';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type {
  CitaParaAgregado,
  ICitasPsicologicasRepository,
} from '../interfaces/citas-psicologicas-repository.interface';

export interface ArchivoReporte {
  contenido: Buffer;
  nombreArchivo: string;
  tipoContenido: string;
}

/** Columnas del Excel de personas atendidas. Sin nombres: el reporte es estadístico. */
export const COLUMNAS_PERSONAS_ATENDIDAS: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'Persona', ancho: 10, tipo: 'texto' },
  { titulo: 'Proceso', ancho: 16, tipo: 'texto' },
  { titulo: 'Edad', ancho: 6, tipo: 'numero' },
  { titulo: 'Rango de edad', ancho: 16, tipo: 'texto' },
  { titulo: 'Grupo étnico', ancho: 16, tipo: 'texto' },
  { titulo: 'Municipio', ancho: 26, tipo: 'texto' },
  { titulo: 'Tipología 22-2008', ancho: 34, tipo: 'texto' },
  { titulo: 'Sesiones', ancho: 9, tipo: 'numero' },
  { titulo: 'Inasistencias', ancho: 12, tipo: 'numero' },
  { titulo: 'Primera sesión', ancho: 13, tipo: 'fecha' },
  { titulo: 'Última sesión', ancho: 13, tipo: 'fecha' },
];

export function aFilaHoja(
  persona: PersonaAtendida,
  indice: number,
): ValorCeldaHoja[] {
  return [
    indice + 1,
    persona.esHijo ? 'Hija/o' : 'Usuaria',
    persona.procesos.join(', '),
    persona.edad,
    ETIQUETAS_RANGO_EDAD[persona.rangoEdad],
    ETIQUETAS_GRUPO_ETNICO[persona.grupoEtnico],
    persona.municipio === MUNICIPIO_FUERA
      ? 'Fuera de Alta Verapaz'
      : ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[persona.municipio],
    persona.tipologias
      .map((tipologia) => ETIQUETAS_TIPOLOGIA_DELITO[tipologia])
      .join(', '),
    persona.sesiones,
    persona.inasistencias,
    persona.primeraSesion,
    persona.ultimaSesion,
  ];
}

@Injectable()
export class IndicadoresPsicologiaService {
  constructor(
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    @Inject(EXPORTADOR_HOJA_CALCULO)
    private readonly exportador: IExportadorHojaCalculo,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Siempre "mis" indicadores: nunca agrega sobre otras psicólogas. Las cifras salen de una
   * sola consulta de las citas del año, agregada en memoria por el dominio (el corte de mes
   * es en hora de Guatemala, nunca con `date_trunc` en la base).
   */
  async obtenerIndicadores(
    query: IndicadoresQuery,
    psicologaId: string,
    contexto: ContextoAuditoria,
  ): Promise<IndicadoresPsicologia> {
    const desde = inicioMesGT(query.anio, 1);
    const hasta = finMesGT(query.anio, 12);

    const [
      procesosActivos,
      procesosIniciadosEnElAnio,
      procesosCerradosEnElAnio,
      primerProceso,
      citas,
    ] = await Promise.all([
      this.atencionRepository.contarCasosActivos(psicologaId),
      this.atencionRepository.contarIniciadosEnRango(psicologaId, desde, hasta),
      this.atencionRepository.contarCerradosEnRango(psicologaId, desde, hasta),
      this.atencionRepository.fechaPrimerProceso(psicologaId),
      this.citasDelAnio(query.anio, psicologaId),
    ]);

    const anioActual = anioActualGT();
    const indicadores: IndicadoresPsicologia = {
      anio: query.anio,
      aniosDisponibles: aniosEntre(
        primerProceso ? anioCalendarioGT(primerProceso) : anioActual,
        anioActual,
      ),
      procesosActivos,
      procesosIniciadosEnElAnio,
      procesosCerradosEnElAnio,
      ...resumirAnio(citas),
    };

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'INDICADORES_PSICOLOGIA_CONSULTADOS',
      entidad: 'AtencionPsicologica',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { anio: query.anio },
    });

    return indicadores;
  }

  /** Excel con una fila por persona atendida en el año, de mis procesos. Se genera en memoria. */
  async exportar(
    query: IndicadoresQuery,
    psicologaId: string,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const personas = personasAtendidas(
      await this.citasDelAnio(query.anio, psicologaId),
    );
    const contenido = await this.exportador.generar({
      nombreHoja: `Personas atendidas ${query.anio}`,
      columnas: COLUMNAS_PERSONAS_ATENDIDAS,
      filas: personas.map(aFilaHoja),
    });

    // Solo el año y cuántas filas: nunca datos de una persona en la bitácora.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_PSICOLOGIA_EXPORTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { anio: query.anio, filas: personas.length },
    });

    return {
      contenido,
      nombreArchivo: `psicologia-personas-atendidas_${query.anio}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }

  private citasDelAnio(
    anio: number,
    psicologaId: string,
  ): Promise<CitaParaAgregado[]> {
    return this.citasRepository.listarCitasEnRango({
      psicologaId,
      desde: inicioMesGT(anio, 1),
      hasta: finMesGT(anio, 12),
    });
  }
}
