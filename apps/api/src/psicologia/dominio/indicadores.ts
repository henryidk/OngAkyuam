import {
  calcularRangoEdad,
  CLINICAS_PSICOLOGIA,
  edadEnFecha,
  ETIQUETAS_CLINICA_PSICOLOGIA,
  ESTADOS_CITA_PSICOLOGICA,
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  ETIQUETAS_TIPOLOGIA_DELITO,
  fechaCalendarioGT,
  GRUPOS_ETNICOS,
  PUESTO_PRACTICANTE,
  MUNICIPIOS_ALTA_VERAPAZ,
  serieDoceMeses,
  TIPOLOGIAS_DELITO,
  TIPOS_CITA_PSICOLOGICA,
  type ConteoReporte,
  type EstadoProcesoReportePsicologia,
  type PeriodoIndicadores,
  type RangoEdad,
  formatearResponsable,
} from '@akyuam/shared';
import type { CitaParaAgregado } from '../interfaces/citas-psicologicas-repository.interface';

/** Municipio de quien no vive en Alta Verapaz: no se desglosa, va en un solo renglón. */
export const MUNICIPIO_FUERA = 'FUERA_DE_ALTA_VERAPAZ';
const ETIQUETA_MUNICIPIO_FUERA = 'Fuera de Alta Verapaz';

const RANGOS_EDAD = Object.keys(ETIQUETAS_RANGO_EDAD) as RangoEdad[];

/** Sesiones atendidas antes de que se pidiera el consultorio. */
export const SIN_ANOTAR = 'SIN_ANOTAR';
export const ETIQUETA_SIN_ANOTAR = 'Sin anotar';

/** Filtros que se aplican sobre las citas ya leídas (la psicóloga se filtra en la consulta). */
export interface FiltrosCitasReporte {
  estadoProceso: EstadoProcesoReportePsicologia;
  incluirNinos: boolean;
}

/**
 * Deja solo las citas que entran en el reporte. El estado es el del proceso hoy (igual que la
 * columna "Estado" del Excel), no el que tenía cuando ocurrió la cita.
 */
export function filtrarCitas(
  citas: CitaParaAgregado[],
  filtros: FiltrosCitasReporte,
): CitaParaAgregado[] {
  return citas.filter(
    (cita) =>
      (filtros.incluirNinos || cita.ninoId === null) &&
      (filtros.estadoProceso === 'TODOS' ||
        (filtros.estadoProceso === 'CONCLUIDOS') === cita.procesoConcluido),
  );
}

type Tipologia = CitaParaAgregado['tipologias'][number];

/** Puesto de la psicóloga titulada en `PUESTOS_POR_AREA.PSICOLOGIA`. */
const PUESTO_PSICOLOGA = 'PSICOLOGA';

/**
 * Quien atendió, como sale en el reporte: "Nombre (licenciada)", "Nombre (practicante)" o, si la
 * cuenta no tiene puesto, solo el nombre.
 */
export function nombreProfesional(profesional: {
  nombreCompleto: string;
  puesto: string | null;
}): string {
  // Sin puesto no se sabe el cargo: solo el nombre, nunca un cargo inventado.
  const cargo =
    profesional.puesto === PUESTO_PRACTICANTE
      ? 'practicante'
      : profesional.puesto === PUESTO_PSICOLOGA
        ? 'licenciada'
        : null;
  return formatearResponsable(profesional.nombreCompleto, cargo);
}

/**
 * Una persona (usuaria o hijo/a) con al menos una sesión atendida en el periodo. No lleva su
 * nombre. Proceso, diagnóstico, enfoque y profesional son los de su sesión atendida más reciente.
 */
export interface PersonaAtendida {
  esHijo: boolean;
  /** Años cumplidos el día de su primera sesión atendida del periodo. */
  edad: number;
  rangoEdad: RangoEdad;
  grupoEtnico: CitaParaAgregado['grupoEtnico'];
  municipio:
    NonNullable<CitaParaAgregado['municipio']> | typeof MUNICIPIO_FUERA;
  tipologias: Tipologia[];
  procesos: string[];
  sesiones: number;
  inasistencias: number;
  /** "YYYY-MM-DD" en hora de Guatemala. */
  primeraSesion: string;
  ultimaSesion: string;
  expedienteNumero: string;
  /** El proceso de la sesión atendida más reciente del periodo. */
  procesoReciente: { id: string; concluido: boolean };
  /** El último anotado en ese proceso (las sesiones previas a que se pidiera no lo tienen). */
  diagnostico: string | null;
  enfoqueTerapeutico: string | null;
  profesional: string;
}

function datosProceso(
  cita: CitaParaAgregado,
): PersonaAtendida['procesoReciente'] {
  return {
    id: cita.procesoId,
    concluido: cita.procesoConcluido,
  };
}

function clavePersona(cita: CitaParaAgregado): string {
  return cita.ninoId ?? cita.usuariaId;
}

function agregarSinRepetir<T>(lista: T[], valores: readonly T[]): void {
  for (const valor of valores) {
    if (!lista.includes(valor)) lista.push(valor);
  }
}

/**
 * Personas atendidas a partir de las citas de un periodo (ordenadas por fecha). Quien solo
 * tuvo citas canceladas o inasistencias no cuenta como atendida.
 */
export function personasAtendidas(
  citas: CitaParaAgregado[],
): PersonaAtendida[] {
  const personas = new Map<string, PersonaAtendida>();
  for (const cita of citas) {
    if (cita.estado !== 'ATENDIDA') continue;
    const dia = fechaCalendarioGT(cita.fechaHora);
    const clave = clavePersona(cita);
    let persona = personas.get(clave);
    if (!persona) {
      const edad = edadEnFecha(cita.fechaNacimiento, dia);
      persona = {
        esHijo: cita.ninoId !== null,
        edad,
        rangoEdad: calcularRangoEdad(edad),
        grupoEtnico: cita.grupoEtnico,
        municipio: cita.municipio ?? MUNICIPIO_FUERA,
        tipologias: [],
        procesos: [],
        sesiones: 0,
        inasistencias: 0,
        primeraSesion: dia,
        ultimaSesion: dia,
        expedienteNumero: cita.expedienteNumero,
        procesoReciente: datosProceso(cita),
        diagnostico: null,
        enfoqueTerapeutico: null,
        profesional: cita.profesional,
      };
      personas.set(clave, persona);
    }
    persona.sesiones += 1;
    persona.ultimaSesion = dia;
    if (persona.procesoReciente.id !== cita.procesoId) {
      // Otro proceso: lo clínico del anterior no se arrastra.
      persona.procesoReciente = datosProceso(cita);
      persona.diagnostico = null;
      persona.enfoqueTerapeutico = null;
    }
    persona.diagnostico = cita.diagnostico ?? persona.diagnostico;
    persona.enfoqueTerapeutico =
      cita.enfoqueTerapeutico ?? persona.enfoqueTerapeutico;
    persona.profesional = cita.profesional;
    persona.expedienteNumero = cita.expedienteNumero;
    agregarSinRepetir(persona.tipologias, cita.tipologias);
    agregarSinRepetir(persona.procesos, [cita.codigoProceso]);
  }

  for (const cita of citas) {
    if (cita.estado !== 'NO_ASISTIO') continue;
    const persona = personas.get(clavePersona(cita));
    if (persona) persona.inasistencias += 1;
  }
  return [...personas.values()];
}

/** Todas las claves del catálogo, aunque tengan 0: los renglones no cambian de lugar entre periodos. */
function desglose<K extends string>(
  claves: readonly K[],
  etiquetas: Record<K, string>,
  valores: Iterable<K>,
): ConteoReporte[] {
  const totales = new Map<K, number>();
  for (const valor of valores) {
    totales.set(valor, (totales.get(valor) ?? 0) + 1);
  }
  return claves.map((clave) => ({
    clave,
    etiqueta: etiquetas[clave],
    total: totales.get(clave) ?? 0,
  }));
}

/** Cifras de un periodo: personas distintas por dimensión y citas por estado y tipo. */
export function resumirPeriodo(citas: CitaParaAgregado[]): PeriodoIndicadores {
  const personas = personasAtendidas(citas);
  return {
    personasAtendidas: personas.length,
    sesionesRealizadas: citas.filter((c) => c.estado === 'ATENDIDA').length,
    inasistencias: citas.filter((c) => c.estado === 'NO_ASISTIO').length,
    citas: citas.length,
    desgloses: {
      rangoEdad: desglose(
        RANGOS_EDAD,
        ETIQUETAS_RANGO_EDAD,
        personas.map((p) => p.rangoEdad),
      ),
      grupoEtnico: desglose(
        GRUPOS_ETNICOS,
        ETIQUETAS_GRUPO_ETNICO,
        personas.map((p) => p.grupoEtnico),
      ),
      tipologia: desglose(
        TIPOLOGIAS_DELITO,
        ETIQUETAS_TIPOLOGIA_DELITO,
        personas.flatMap((p) => p.tipologias),
      ),
      municipio: desglose(
        [...MUNICIPIOS_ALTA_VERAPAZ, MUNICIPIO_FUERA],
        {
          ...ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
          [MUNICIPIO_FUERA]: ETIQUETA_MUNICIPIO_FUERA,
        },
        personas.map((p) => p.municipio),
      ),
      citasPorEstado: desglose(
        ESTADOS_CITA_PSICOLOGICA,
        ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
        citas.map((c) => c.estado),
      ),
      citasPorTipo: desglose(
        TIPOS_CITA_PSICOLOGICA,
        ETIQUETAS_TIPO_CITA_PSICOLOGICA,
        citas.map((c) => c.tipo),
      ),
      sesionesPorClinica: desglose(
        [...CLINICAS_PSICOLOGIA, SIN_ANOTAR],
        { ...ETIQUETAS_CLINICA_PSICOLOGIA, [SIN_ANOTAR]: ETIQUETA_SIN_ANOTAR },
        citas
          .filter((c) => c.estado === 'ATENDIDA')
          .map((c) => c.clinica ?? SIN_ANOTAR),
      ),
    },
  };
}

/**
 * El año completo y sus 12 meses. El mes se corta en hora de Guatemala: una cita del 30 de
 * junio a las 23:00 es de junio aunque en UTC ya sea julio.
 */
export function resumirAnio(citas: CitaParaAgregado[]): {
  anual: PeriodoIndicadores;
  meses: PeriodoIndicadores[];
} {
  const porMes = new Map<number, CitaParaAgregado[]>();
  for (const cita of citas) {
    const mes = Number(fechaCalendarioGT(cita.fechaHora).slice(5, 7));
    const delMes = porMes.get(mes) ?? [];
    delMes.push(cita);
    porMes.set(mes, delMes);
  }
  const resumenes = new Map<number, PeriodoIndicadores>();
  for (const [mes, delMes] of porMes)
    resumenes.set(mes, resumirPeriodo(delMes));

  return {
    anual: resumirPeriodo(citas),
    meses: serieDoceMeses(resumenes, () => resumirPeriodo([])),
  };
}
