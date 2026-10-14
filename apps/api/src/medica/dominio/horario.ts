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

/** El inicio cae en un día hábil y en una de las horas del horario, al minuto exacto. */
export function dentroDeHorario(inicio: Date): boolean {
  if (inicio.getUTCSeconds() !== 0 || inicio.getUTCMilliseconds() !== 0) {
    return false;
  }
  return (
    esDiaHabil(fechaCalendarioGT(inicio)) && HORAS.includes(horaGT(inicio))
  );
}

/** Los próximos `cantidad` días hábiles a partir de `desde` (inclusive). */
export function diasHabilesDesde(desde: string, cantidad: number): string[] {
  const dias: string[] = [];
  for (
    let fecha = desde;
    dias.length < cantidad;
    fecha = sumarDiasGT(fecha, 1)
  ) {
    if (esDiaHabil(fecha)) {
      dias.push(fecha);
    }
  }
  return dias;
}

/**
 * Horas del día que siguen libres: ni ocupadas por una cita vigente ni ya empezadas. Un día
 * inhábil no tiene ninguna.
 */
export function horasLibres(
  fecha: string,
  ocupadas: ReadonlySet<string>,
  ahora: Date,
): string[] {
  if (!esDiaHabil(fecha)) {
    return [];
  }
  return HORAS.filter(
    (hora) =>
      !ocupadas.has(hora) &&
      inicioCita(fecha, hora).getTime() > ahora.getTime(),
  );
}
