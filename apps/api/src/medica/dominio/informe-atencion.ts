import {
  edadEnFecha,
  fechaCalendarioGT,
  FILAS_INFORME_ATENCION_MEDICA,
  GRUPOS_ETNICOS,
  RANGOS_EDAD_INFORME_MEDICA,
  rangoEdadInformeMedica,
  type CifrasInformeAtencionMedica,
  type FilaInformeAtencionMedica,
  type FilaInformeAtencionMedicaClave,
  type ModalidadConsultaMedica,
  type TipoIngresoArea,
} from '@akyuam/shared';

type GrupoEtnico = (typeof GRUPOS_ETNICOS)[number];

/** Una consulta del periodo, con lo justo para el informe. Nunca datos clínicos ni nombres. */
export interface ConsultaParaInforme {
  fechaHora: Date;
  modalidad: ModalidadConsultaMedica;
  usuariaId: string;
  /** Hijo/a atendido (su identidad estable, no el enlace al expediente); null = la usuaria. */
  hijoId: string | null;
  /** Usuaria: siempre mujer. Hijo/a: el de su registro. */
  sexo: 'MUJER' | 'HOMBRE';
  /** "YYYY-MM-DD" de la persona atendida. */
  fechaNacimiento: string;
  /** Hijas/os heredan el de la madre (lo registra Trabajo Social). */
  grupoEtnico: GrupoEtnico;
  /** Ingreso de la usuaria a Médica en la referencia de esta atención. */
  ingresoUsuaria: TipoIngresoArea;
  /** La usuaria tuvo una consulta propia antes del periodo (en cualquier atención). */
  usuariaAtendidaAntes: boolean;
  /** "YYYY-MM-DD" de ingreso y egreso del albergue en el expediente; null = sin dato. */
  ingresoAlbergue: string | null;
  egresoAlbergue: string | null;
}

/** Una persona o una atención que entra en un renglón. */
interface Registro {
  sexo: 'MUJER' | 'HOMBRE';
  grupoEtnico: GrupoEtnico;
  edad: number;
}

/**
 * Nuevo ingreso: la referencia es su primer ingreso a Médica y su primera consulta propia cae en el
 * periodo. Si ya se le atendió antes, en el periodo es seguimiento.
 */
function esNuevoIngreso(consulta: ConsultaParaInforme): boolean {
  return (
    consulta.ingresoUsuaria === 'PRIMER_INGRESO' &&
    !consulta.usuariaAtendidaAntes
  );
}

/** La consulta se dio mientras la usuaria estaba en el albergue. */
function enAlbergue(consulta: ConsultaParaInforme): boolean {
  if (consulta.ingresoAlbergue === null) return false;
  const dia = fechaCalendarioGT(consulta.fechaHora);
  return (
    consulta.ingresoAlbergue <= dia &&
    (consulta.egresoAlbergue === null || dia <= consulta.egresoAlbergue)
  );
}

function registroDe(consulta: ConsultaParaInforme): Registro {
  return {
    sexo: consulta.sexo,
    grupoEtnico: consulta.grupoEtnico,
    edad: edadEnFecha(
      consulta.fechaNacimiento,
      fechaCalendarioGT(consulta.fechaHora),
    ),
  };
}

export function cifrasVacias(): CifrasInformeAtencionMedica {
  return {
    mujer: 0,
    hombre: 0,
    etnia: Object.fromEntries(GRUPOS_ETNICOS.map((g) => [g, 0])) as Record<
      GrupoEtnico,
      number
    >,
    edad: Object.fromEntries(
      RANGOS_EDAD_INFORME_MEDICA.map((r) => [r, 0]),
    ) as CifrasInformeAtencionMedica['edad'],
    total: 0,
  };
}

function cifrasDe(registros: Iterable<Registro>): CifrasInformeAtencionMedica {
  const cifras = cifrasVacias();
  for (const registro of registros) {
    if (registro.sexo === 'MUJER') cifras.mujer += 1;
    else cifras.hombre += 1;
    cifras.etnia[registro.grupoEtnico] += 1;
    cifras.edad[rangoEdadInformeMedica(registro.edad)] += 1;
    cifras.total += 1;
  }
  return cifras;
}

function sumar(
  a: CifrasInformeAtencionMedica,
  b: CifrasInformeAtencionMedica,
): CifrasInformeAtencionMedica {
  return {
    mujer: a.mujer + b.mujer,
    hombre: a.hombre + b.hombre,
    etnia: Object.fromEntries(
      GRUPOS_ETNICOS.map((g) => [g, a.etnia[g] + b.etnia[g]]),
    ) as CifrasInformeAtencionMedica['etnia'],
    edad: Object.fromEntries(
      RANGOS_EDAD_INFORME_MEDICA.map((r) => [r, a.edad[r] + b.edad[r]]),
    ) as CifrasInformeAtencionMedica['edad'],
    total: a.total + b.total,
  };
}

/**
 * Informe de atención con el formato de la ONG. Las personas se cuentan una vez por renglón, con
 * la edad del día de su primera consulta del periodo; las atenciones telefónicas se cuentan por
 * consulta.
 *
 * - Nuevo ingreso / seguimiento: usuarias con consulta propia en el periodo (ver `esNuevoIngreso`).
 *   Si en el periodo fue las dos cosas (vuelve con otra referencia), cuenta como nuevo ingreso.
 * - Indirectos: hijos/as atendidos en el periodo cuya madre es de nuevo ingreso.
 * - Albergadas: usuarias con alguna consulta propia mientras estaban en el albergue.
 */
export function armarInformeAtencion(
  consultas: readonly ConsultaParaInforme[],
): {
  filas: FilaInformeAtencionMedica[];
  totales: CifrasInformeAtencionMedica;
} {
  const ordenadas = [...consultas].sort(
    (a, b) => a.fechaHora.getTime() - b.fechaHora.getTime(),
  );
  const propias = ordenadas.filter((c) => c.hijoId === null);
  const nuevas = new Set(
    propias.filter(esNuevoIngreso).map((c) => c.usuariaId),
  );

  // Primera aparición de cada persona en el renglón: de ahí sale su edad.
  const personas = (
    lista: readonly ConsultaParaInforme[],
    clave: (c: ConsultaParaInforme) => string,
  ): Registro[] => {
    const vistas = new Map<string, Registro>();
    for (const consulta of lista) {
      if (!vistas.has(clave(consulta))) {
        vistas.set(clave(consulta), registroDe(consulta));
      }
    }
    return [...vistas.values()];
  };

  const registros: Record<FilaInformeAtencionMedicaClave, Registro[]> = {
    NUEVO_INGRESO: personas(
      propias.filter((c) => nuevas.has(c.usuariaId)),
      (c) => c.usuariaId,
    ),
    SEGUIMIENTO: personas(
      propias.filter((c) => !nuevas.has(c.usuariaId)),
      (c) => c.usuariaId,
    ),
    INDIRECTOS: personas(
      ordenadas.filter((c) => c.hijoId !== null && nuevas.has(c.usuariaId)),
      (c) => c.hijoId ?? '',
    ),
    TELEFONICA: ordenadas
      .filter((c) => c.modalidad === 'TELEFONICA')
      .map(registroDe),
    ALBERGADAS: personas(propias.filter(enAlbergue), (c) => c.usuariaId),
  };

  const filas = FILAS_INFORME_ATENCION_MEDICA.map(
    (clave): FilaInformeAtencionMedica => ({
      clave,
      ...cifrasDe(registros[clave]),
    }),
  );
  return { filas, totales: filas.reduce(sumar, cifrasVacias()) };
}
