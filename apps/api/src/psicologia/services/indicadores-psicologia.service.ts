import { Inject, Injectable } from '@nestjs/common';
import {
  anioActualGT,
  anioCalendarioGT,
  aniosEntre,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPOLOGIA_DELITO,
  finDiaGT,
  finMesGT,
  fechaCalendarioGT,
  inicioDiaGT,
  inicioMesGT,
  semanaDelMesGT,
  type ExportarPsicologiaQuery,
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

/**
 * Columnas del Excel de personas atendidas. Sin el nombre de la persona atendida; sí el de la
 * profesional ("Responsable"). Diagnóstico, enfoque, estado y semana son del proceso de su sesión
 * más reciente. El ingreso por área (primer ingreso / seguimiento) no va en el Excel.
 */
export const COLUMNAS_PERSONAS_ATENDIDAS: ColumnaHoja[] = [
  { titulo: 'No.', ancho: 6, tipo: 'numero' },
  { titulo: 'Persona', ancho: 10, tipo: 'texto' },
  { titulo: 'No. expediente', ancho: 14, tipo: 'texto' },
  { titulo: 'Proceso', ancho: 16, tipo: 'texto' },
  { titulo: 'Edad', ancho: 6, tipo: 'numero' },
  { titulo: 'Rango de edad', ancho: 16, tipo: 'texto' },
  { titulo: 'Grupo étnico', ancho: 16, tipo: 'texto' },
  { titulo: 'Municipio', ancho: 26, tipo: 'texto' },
  { titulo: 'Tipología 22-2008', ancho: 34, tipo: 'texto' },
  { titulo: 'Diagnóstico', ancho: 40, tipo: 'texto' },
  { titulo: 'Enfoque terapéutico', ancho: 30, tipo: 'texto' },
  { titulo: 'Semana de atención', ancho: 11, tipo: 'numero' },
  { titulo: 'Sesiones', ancho: 9, tipo: 'numero' },
  { titulo: 'Inasistencias', ancho: 12, tipo: 'numero' },
  { titulo: 'Primera sesión', ancho: 13, tipo: 'fecha' },
  { titulo: 'Última sesión', ancho: 13, tipo: 'fecha' },
  { titulo: 'Estado', ancho: 13, tipo: 'texto' },
  { titulo: 'Responsable', ancho: 32, tipo: 'texto' },
];

/**
 * `inicioProceso` = primera sesión atendida del proceso ("YYYY-MM-DD" GT): de ella sale la semana
 * del mes en que empezó la atención. Puede ser de un año anterior al del reporte.
 */
export function aFilaHoja(
  persona: PersonaAtendida,
  indice: number,
  inicioProceso: string,
): ValorCeldaHoja[] {
  return [
    indice + 1,
    persona.esHijo ? 'Hija/o' : 'Usuaria',
    persona.numeroExpediente,
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
    persona.diagnostico ?? '',
    persona.enfoqueTerapeutico ?? '',
    semanaDelMesGT(inicioProceso),
    persona.sesiones,
    persona.inasistencias,
    persona.primeraSesion,
    persona.ultimaSesion,
    persona.procesoReciente.concluido ? 'Concluido' : 'En atención',
    persona.profesional,
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

  /**
   * Excel con una fila por persona atendida entre `desde` y `hasta` (fechas de calendario en
   * Guatemala, inclusive), solo de mis procesos. Se genera en memoria. Lleva diagnóstico y
   * enfoque (texto clínico): nunca va a la bitácora.
   */
  async exportar(
    query: ExportarPsicologiaQuery,
    psicologaId: string,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const personas = personasAtendidas(
      await this.citasRepository.listarCitasEnRango({
        psicologaId,
        desde: inicioDiaGT(query.desde),
        hasta: finDiaGT(query.hasta),
      }),
    );
    const inicios = await this.citasRepository.primerasSesionesAtendidas([
      ...new Set(personas.map((persona) => persona.procesoReciente.id)),
    ]);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Personas atendidas',
      columnas: COLUMNAS_PERSONAS_ATENDIDAS,
      filas: personas.map((persona, indice) => {
        const inicio = inicios.get(persona.procesoReciente.id);
        // Siempre hay una: la persona tuvo al menos una sesión atendida en ese proceso.
        return aFilaHoja(
          persona,
          indice,
          inicio ? fechaCalendarioGT(inicio) : persona.primeraSesion,
        );
      }),
    });

    // Solo el rango y cuántas filas: nunca datos de una persona en la bitácora.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REPORTE_PSICOLOGIA_EXPORTADO',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: {
        desde: query.desde,
        hasta: query.hasta,
        filas: personas.length,
      },
    });

    return {
      contenido,
      // Solo el rango de fechas en el nombre: nunca datos de una persona.
      nombreArchivo: `psicologia-personas-atendidas_${query.desde}_${query.hasta}.${this.exportador.extension}`,
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
