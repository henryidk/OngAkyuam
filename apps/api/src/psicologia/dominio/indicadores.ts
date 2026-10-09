import {
  calcularRangoEdad,
  edadEnFecha,
  ESTADOS_CITA_PSICOLOGICA,
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  ETIQUETAS_TIPOLOGIA_DELITO,
  fechaCalendarioGT,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  serieDoceMeses,
  TIPOLOGIAS_DELITO,
  TIPOS_CITA_PSICOLOGICA,
  type ConteoReporte,
  type PeriodoIndicadores,
  type RangoEdad,
} from '@akyuam/shared';
import type { CitaParaAgregado } from '../interfaces/citas-psicologicas-repository.interface';

/** Municipio de quien no vive en Alta Verapaz: no se desglosa, va en un solo renglón. */
export const MUNICIPIO_FUERA = 'FUERA_DE_ALTA_VERAPAZ';
const ETIQUETA_MUNICIPIO_FUERA = 'Fuera de Alta Verapaz';

const RANGOS_EDAD = Object.keys(ETIQUETAS_RANGO_EDAD) as RangoEdad[];

type Tipologia = CitaParaAgregado['tipologias'][number];

/**
 * Una persona (usuaria o hijo/a) con al menos una sesión atendida en el periodo. No lleva
 * nombre: los reportes de Psicología son estadísticos.
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
      };
      personas.set(clave, persona);
    }
    persona.sesiones += 1;
    persona.ultimaSesion = dia;
    agregarSinRepetir(persona.tipologias, cita.tipologias);
    agregarSinRepetir(persona.procesos, [cita.procesoCodigo]);
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
