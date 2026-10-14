import {
  calcularRangoEdad,
  edadEnFecha,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPOLOGIA_DELITO,
  fechaCalendarioGT,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  serieDoceMeses,
  TIPOLOGIAS_DELITO,
  UMBRAL_ANONIMATO,
  type ConteoReporte,
  type PeriodoMedica,
  type RangoEdad,
} from '@akyuam/shared';

/** Municipio de quien no vive en Alta Verapaz: no se desglosa, va en un solo renglón. */
export const MUNICIPIO_FUERA = 'FUERA_DE_ALTA_VERAPAZ';
const ETIQUETA_MUNICIPIO_FUERA = 'Fuera de Alta Verapaz';

const RANGOS_EDAD = Object.keys(ETIQUETAS_RANGO_EDAD) as RangoEdad[];

type GrupoEtnico = (typeof GRUPOS_ETNICOS)[number];
type Municipio = (typeof MUNICIPIOS_ALTA_VERAPAZ)[number];
type Tipologia = (typeof TIPOLOGIAS_DELITO)[number];

/** Una consulta registrada, con lo justo para agregar. Nunca datos clínicos ni nombres. */
export interface ConsultaParaAgregado {
  fechaHora: Date;
  usuariaId: string;
  /** null = la usuaria. */
  ninoId: string | null;
  /** "YYYY-MM-DD" de la persona atendida. */
  fechaNacimiento: string;
  /** Hijas/os heredan el de la madre. */
  grupoEtnico: GrupoEtnico;
  municipio: Municipio | null;
  tipologias: readonly Tipologia[];
  /** Es la primera consulta de su atención médica. */
  esPrimera: boolean;
}

interface PersonaAtendida {
  rangoEdad: RangoEdad;
  grupoEtnico: GrupoEtnico;
  municipio: Municipio | typeof MUNICIPIO_FUERA;
  tipologias: Tipologia[];
}

/** Personas distintas (usuaria o hijo/a); la edad es la del día de su primera consulta del periodo. */
function personasAtendidas(
  consultas: readonly ConsultaParaAgregado[],
): PersonaAtendida[] {
  const ordenadas = [...consultas].sort(
    (a, b) => a.fechaHora.getTime() - b.fechaHora.getTime(),
  );
  const personas = new Map<string, PersonaAtendida>();
  for (const consulta of ordenadas) {
    const clave = consulta.ninoId ?? consulta.usuariaId;
    let persona = personas.get(clave);
    if (!persona) {
      persona = {
        rangoEdad: calcularRangoEdad(
          edadEnFecha(
            consulta.fechaNacimiento,
            fechaCalendarioGT(consulta.fechaHora),
          ),
        ),
        grupoEtnico: consulta.grupoEtnico,
        municipio: consulta.municipio ?? MUNICIPIO_FUERA,
        tipologias: [],
      };
      personas.set(clave, persona);
    }
    for (const tipologia of consulta.tipologias) {
      if (!persona.tipologias.includes(tipologia)) {
        persona.tipologias.push(tipologia);
      }
    }
  }
  return [...personas.values()];
}

/** Todas las claves del catálogo, aunque tengan 0: los renglones no cambian de lugar. */
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

export function resumirPeriodo(
  consultas: readonly ConsultaParaAgregado[],
): PeriodoMedica {
  const personas = personasAtendidas(consultas);
  return {
    consultas: consultas.length,
    personasAtendidas: personas.length,
    primerasConsultas: consultas.filter((c) => c.esPrimera).length,
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
    },
  };
}

/** El año y sus 12 meses. El mes se corta en hora de Guatemala. */
export function resumirAnio(consultas: readonly ConsultaParaAgregado[]): {
  anual: PeriodoMedica;
  meses: PeriodoMedica[];
} {
  const porMes = new Map<number, ConsultaParaAgregado[]>();
  for (const consulta of consultas) {
    const mes = Number(fechaCalendarioGT(consulta.fechaHora).slice(5, 7));
    const delMes = porMes.get(mes) ?? [];
    delMes.push(consulta);
    porMes.set(mes, delMes);
  }
  const resumenes = new Map<number, PeriodoMedica>();
  for (const [mes, delMes] of porMes) {
    resumenes.set(mes, resumirPeriodo(delMes));
  }
  return {
    anual: resumirPeriodo(consultas),
    meses: serieDoceMeses(resumenes, () => resumirPeriodo([])),
  };
}

/**
 * Cifra publicable en el Excel: 1 o 2 personas en un municipio o grupo pequeño pueden
 * identificar a alguien, así que se muestran como "<3". El 0 sí se publica.
 */
export function cifraAnonima(total: number): number | string {
  return total > 0 && total < UMBRAL_ANONIMATO ? `<${UMBRAL_ANONIMATO}` : total;
}
