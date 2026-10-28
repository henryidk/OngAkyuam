import {
  DURACION_CITA_MEDICA_MIN,
  HORARIO_MEDICINA,
  diaSemanaGT,
  fechaCalendarioGT,
  horaGT,
  parseLocalGT,
  sumarDiasGT,
} from '@akyuam/shared';

/**
 * El horario de la médica, sin I/O: qué días y horas admiten una cita. Todas las fechas son de
 * calendario en Guatemala ("YYYY-MM-DD") y las horas "HH:mm"; los instantes, `Date` en UTC.
 */

const HORAS: readonly string[] = HORARIO_MEDICINA.horas;
const DIAS: readonly number[] = HORARIO_MEDICINA.diasLaborables;

export function esDiaHabil(fecha: string): boolean {
  return DIAS.includes(diaSemanaGT(fecha));
}

/** El instante en que empieza una cita de ese día a esa hora (hora de Guatemala). */
export function inicioCita(fecha: string, hora: string): Date {
  return parseLocalGT(`${fecha}T${hora}`);
}

export function finCita(
  inicio: Date,
  duracionMin: number = DURACION_CITA_MEDICA_MIN,
): Date {
  return new Date(inicio.getTime() + duracionMin * 60_000);
}

/** "HH:mm" en que termina una cita que empieza a `hora`. */
export function horaFin(
  hora: string,
  duracionMin: number = DURACION_CITA_MEDICA_MIN,
): string {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + duracionMin;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Bloques del horario ("HH:mm") que ocupa una cita que empieza a `hora`: uno por cada
 * `DURACION_CITA_MEDICA_MIN` de su duración (una de 1 h a las 09:00 ocupa 09:00 y 09:30).
 */
export function bloquesDeCita(
  hora: string,
  duracionMin: number = DURACION_CITA_MEDICA_MIN,
): string[] {
  const bloques: string[] = [];
  for (let min = 0; min < duracionMin; min += DURACION_CITA_MEDICA_MIN) {
    bloques.push(horaFin(hora, min));
  }
  return bloques;
}

/** Todos los bloques de la cita son horas del horario: empieza a una hora válida y termina a tiempo. */
function cabenLosBloques(hora: string, duracionMin: number): boolean {
  return bloquesDeCita(hora, duracionMin).every((bloque) =>
    HORAS.includes(bloque),
  );
}

/**
 * El inicio cae en un día hábil, al minuto exacto, y la cita completa (todos sus bloques) queda
 * dentro del horario: una de 1 h 30 no puede empezar a las 16:30.
 */
export function dentroDeHorario(
  inicio: Date,
  duracionMin: number = DURACION_CITA_MEDICA_MIN,
): boolean {
  if (inicio.getUTCSeconds() !== 0 || inicio.getUTCMilliseconds() !== 0) {
    return false;
  }
  return (
    esDiaHabil(fechaCalendarioGT(inicio)) &&
    cabenLosBloques(horaGT(inicio), duracionMin)
  );
}

/** Los días hábiles de `desde` a `hasta`, ambos inclusive (vacío si `hasta` es anterior). */
export function diasHabilesEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDiasGT(fecha, 1)) {
    if (esDiaHabil(fecha)) {
      dias.push(fecha);
    }
  }
  return dias;
}

/**
 * Bloques ocupados por día ("YYYY-MM-DD" → horas "HH:mm") a partir de las citas vigentes, cada
 * una con su duración.
 */
export function bloquesOcupadosPorDia(
  citas: readonly { inicio: Date; duracionMin: number }[],
): Map<string, Set<string>> {
  const porDia = new Map<string, Set<string>>();
  for (const cita of citas) {
    const dia = fechaCalendarioGT(cita.inicio);
    const bloques = porDia.get(dia) ?? new Set<string>();
    for (const bloque of bloquesDeCita(horaGT(cita.inicio), cita.duracionMin)) {
      bloques.add(bloque);
    }
    porDia.set(dia, bloques);
  }
  return porDia;
}

/**
 * Horas del día en las que puede empezar una cita de `duracionMin`: todos sus bloques seguidos
 * están libres y dentro del horario, y aún no empezó. Un día inhábil no tiene ninguna.
 */
export function horasLibres(
  fecha: string,
  ocupadas: ReadonlySet<string>,
  ahora: Date,
  duracionMin: number = DURACION_CITA_MEDICA_MIN,
): string[] {
  if (!esDiaHabil(fecha)) {
    return [];
  }
  return HORAS.filter(
    (hora) =>
      cabenLosBloques(hora, duracionMin) &&
      bloquesDeCita(hora, duracionMin).every(
        (bloque) => !ocupadas.has(bloque),
      ) &&
      inicioCita(fecha, hora).getTime() > ahora.getTime(),
  );
}
