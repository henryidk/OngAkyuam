import { Inject, Injectable } from '@nestjs/common';
import {
  anioActualGT,
  anioCalendarioGT,
  aniosEntre,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPOLOGIA_DELITO,
  finDiaGT,
  finMesGT,
  fechaCalendarioGT,
  inicioDiaGT,
  inicioMesGT,
  MOTIVOS_CIERRE_PSICOLOGIA,
  semanaDelMesGT,
  type ConteoReporte,
  FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA,
  type ExportarPsicologiaQuery,
  type FilaPersonaAtendidaPsicologia,
  type IndicadoresPsicologia,
  type IndicadoresQuery,
  type PersonasAtendidasPsicologia,
  type PersonasAtendidasPsicologiaQuery,
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
  ETIQUETA_SIN_ANOTAR,
  filtrarCitas,
  MUNICIPIO_FUERA,
  personasAtendidas,
  SIN_ANOTAR,
  resumirAnio,
  type PersonaAtendida,
} from '../dominio/indicadores';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';

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
 * La fila tipada de una persona atendida: la misma para la tabla en pantalla y para el Excel.
 * `inicioProceso` = primera sesión atendida del proceso ("YYYY-MM-DD" GT): de ella sale la semana
 * del mes en que empezó la atención. Puede ser de un año anterior al del reporte.
 */
export function aFilaPersona(
  persona: PersonaAtendida,
  indice: number,
  inicioProceso: string,
): FilaPersonaAtendidaPsicologia {
  return {
    numero: indice + 1,
    persona: persona.esHijo ? 'Hija/o' : 'Usuaria',
    expedienteNumero: persona.expedienteNumero,
    procesos: persona.procesos.join(', '),
    edad: persona.edad,
    rangoEdad: ETIQUETAS_RANGO_EDAD[persona.rangoEdad],
    grupoEtnico: ETIQUETAS_GRUPO_ETNICO[persona.grupoEtnico],
    municipio:
      persona.municipio === MUNICIPIO_FUERA
        ? 'Fuera de Alta Verapaz'
        : ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[persona.municipio],
    tipologia: persona.tipologias
      .map((tipologia) => ETIQUETAS_TIPOLOGIA_DELITO[tipologia])
      .join(', '),
    diagnostico: persona.diagnostico ?? '',
    enfoqueTerapeutico: persona.enfoqueTerapeutico ?? '',
    semanaAtencion: semanaDelMesGT(inicioProceso),
    sesiones: persona.sesiones,
    inasistencias: persona.inasistencias,
    primeraSesion: persona.primeraSesion,
    ultimaSesion: persona.ultimaSesion,
    estado: persona.procesoReciente.concluido ? 'Concluido' : 'En atención',
    responsable: persona.profesional,
  };
}

/** Las celdas del Excel, en el orden de `COLUMNAS_PERSONAS_ATENDIDAS`. */
export function aFilaHoja(
  fila: FilaPersonaAtendidaPsicologia,
): ValorCeldaHoja[] {
  return [
    fila.numero,
    fila.persona,
    fila.expedienteNumero,
    fila.procesos,
    fila.edad,
    fila.rangoEdad,
    fila.grupoEtnico,
    fila.municipio,
    fila.tipologia,
    fila.diagnostico,
    fila.enfoqueTerapeutico,
    fila.semanaAtencion,
    fila.sesiones,
    fila.inasistencias,
    fila.primeraSesion,
    fila.ultimaSesion,
    fila.estado,
    fila.responsable,
  ];
}

/** "MIOS" = quien consulta; "EQUIPO" = toda el área (`null`); si no, el id de una psicóloga. */
export function resolverPsicologa(
  profesional: IndicadoresQuery['profesional'],
  usuarioId: string,
): string | null {
  if (profesional === 'MIOS') return usuarioId;
  if (profesional === 'EQUIPO') return null;
  return profesional;
}

/** Los filtros en la bitácora: ids y valores de catálogo, nunca datos de una persona atendida. */
function filtrosAuditados(
  query:
    | IndicadoresQuery
    | ExportarPsicologiaQuery
    | PersonasAtendidasPsicologiaQuery,
) {
  return {
    profesional: query.profesional,
    estadoProceso: query.estadoProceso,
    incluirNinos: query.incluirNinos,
  };
}

/** Todos los motivos del catálogo, aunque tengan 0, y "Sin anotar" para los cierres antiguos. */
function desgloseCierres(
  grupos: {
    motivo: (typeof MOTIVOS_CIERRE_PSICOLOGIA)[number] | null;
    total: number;
  }[],
): ConteoReporte[] {
  const total = (motivo: string | null) =>
    grupos.find((grupo) => grupo.motivo === motivo)?.total ?? 0;
  return [
    ...MOTIVOS_CIERRE_PSICOLOGIA.map((motivo) => ({
      clave: motivo,
      etiqueta: ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA[motivo],
      total: total(motivo),
    })),
    { clave: SIN_ANOTAR, etiqueta: ETIQUETA_SIN_ANOTAR, total: total(null) },
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
   * Cifras del año de mis procesos, de los del equipo o de los de una psicóloga (cualquier
   * psicóloga puede ver las del área). Las cifras salen de una sola consulta de las citas del
   * año, agregada en memoria por el dominio (el corte de mes es en hora de Guatemala, nunca con
   * `date_trunc` en la base). Los conteos de procesos solo dependen de la psicóloga elegida.
   */
  async obtenerIndicadores(
    query: IndicadoresQuery,
    usuarioId: string,
    contexto: ContextoAuditoria,
  ): Promise<IndicadoresPsicologia> {
    const desde = inicioMesGT(query.anio, 1);
    const hasta = finMesGT(query.anio, 12);
    const psicologaId = resolverPsicologa(query.profesional, usuarioId);

    const [
      procesosActivos,
      procesosIniciadosEnElAnio,
      procesosCerradosEnElAnio,
      cerradosPorMotivo,
      primerProceso,
      profesionales,
      citas,
    ] = await Promise.all([
      this.atencionRepository.contarCasosActivos(psicologaId),
      this.atencionRepository.contarIniciadosEnRango(psicologaId, desde, hasta),
      this.atencionRepository.contarCerradosEnRango(psicologaId, desde, hasta),
      this.atencionRepository.contarCerradosPorMotivo(
        psicologaId,
        desde,
        hasta,
      ),
      this.atencionRepository.fechaPrimerProceso(psicologaId),
      this.atencionRepository.listarPsicologas(),
      this.citasRepository.listarCitasEnRango({ psicologaId, desde, hasta }),
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
      cierresPorMotivo: desgloseCierres(cerradosPorMotivo),
      profesionales,
      ...resumirAnio(filtrarCitas(citas, query)),
    };

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'INDICADORES_PSICOLOGIA_CONSULTADOS',
      entidad: 'AtencionPsicologica',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { anio: query.anio, ...filtrosAuditados(query) },
    });

    return indicadores;
  }

  /**
   * Excel con una fila por persona atendida entre `desde` y `hasta` (fechas de calendario en
   * Guatemala, inclusive), con los mismos filtros que las cifras. Se genera en memoria. Lleva
   * diagnóstico y enfoque (texto clínico): nunca va a la bitácora.
   */
  async exportar(
    query: ExportarPsicologiaQuery,
    usuarioId: string,
    contexto: ContextoAuditoria,
  ): Promise<ArchivoReporte> {
    const filas = await this.filasPersonas(query, usuarioId);
    const contenido = await this.exportador.generar({
      nombreHoja: 'Personas atendidas',
      columnas: COLUMNAS_PERSONAS_ATENDIDAS,
      filas: filas.map(aFilaHoja),
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
        ...filtrosAuditados(query),
        filas: filas.length,
      },
    });

    return {
      contenido,
      // Solo el rango de fechas en el nombre: nunca datos de una persona.
      nombreArchivo: `psicologia-personas-atendidas_${query.desde}_${query.hasta}.${this.exportador.extension}`,
      tipoContenido: this.exportador.tipoContenido,
    };
  }

  /**
   * Vista previa del Excel en pantalla: las mismas filas, de 25 en 25. Diagnóstico y enfoque son
   * texto clínico: a la bitácora solo van el rango, los filtros, la página y el total.
   */
  async listarPersonas(
    query: PersonasAtendidasPsicologiaQuery,
    usuarioId: string,
    contexto: ContextoAuditoria,
  ): Promise<PersonasAtendidasPsicologia> {
    const filas = await this.filasPersonas(query, usuarioId);
    const ultimaPagina = Math.max(
      1,
      Math.ceil(filas.length / FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA),
    );
    // Si los filtros cambiaron y la página quedó fuera, se entrega la última.
    const pagina = Math.min(query.pagina, ultimaPagina);
    const inicio = (pagina - 1) * FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA;

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PERSONAS_ATENDIDAS_PSICOLOGIA_CONSULTADAS',
      entidad: 'Reporte',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: {
        desde: query.desde,
        hasta: query.hasta,
        ...filtrosAuditados(query),
        pagina,
        total: filas.length,
      },
    });

    return {
      filas: filas.slice(inicio, inicio + FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA),
      total: filas.length,
      pagina,
    };
  }

  /** Todas las filas del rango con los filtros: la fuente única del Excel y de la tabla. */
  private async filasPersonas(
    query: ExportarPsicologiaQuery,
    usuarioId: string,
  ): Promise<FilaPersonaAtendidaPsicologia[]> {
    const citas = await this.citasRepository.listarCitasEnRango({
      psicologaId: resolverPsicologa(query.profesional, usuarioId),
      desde: inicioDiaGT(query.desde),
      hasta: finDiaGT(query.hasta),
    });
    const personas = personasAtendidas(filtrarCitas(citas, query));
    const inicios = await this.citasRepository.primerasSesionesAtendidas([
      ...new Set(personas.map((persona) => persona.procesoReciente.id)),
    ]);
    return personas.map((persona, indice) => {
      const inicio = inicios.get(persona.procesoReciente.id);
      // Siempre hay una: la persona tuvo al menos una sesión atendida en ese proceso.
      return aFilaPersona(
        persona,
        indice,
        inicio ? fechaCalendarioGT(inicio) : persona.primeraSesion,
      );
    });
  }
}
