import { HORARIO_PSICOLOGIA, type HuecoLibreDto } from '@akyuam/shared';

// Huecos libres de un día de la agenda. Función pura: recibe minutos desde la medianoche de
// Guatemala y no lee la base ni el reloj. Solo sugiere dónde hay espacio; agendar fuera de
// estos tramos sigue permitido.

export interface TramoOcupado {
  inicioMin: number;
  finMin: number;
}

export type HorarioAtencion = {
  readonly diasLaborables: readonly number[];
  readonly inicioMin: number;
  readonly finMin: number;
  readonly minimoMin: number;
  readonly redondeoMin: number;
};

/**
 * @param ocupados citas que ocupan agenda ese día (las canceladas y reprogramadas no cuentan).
 * @param diaSemana día ISO (1 = lunes … 7 = domingo).
 * @param ahoraMin minuto actual si el día es hoy; `null` si es un día futuro.
 */
export function huecosLibres(
  ocupados: TramoOcupado[],
  diaSemana: number,
  ahoraMin: number | null,
  horario: HorarioAtencion = HORARIO_PSICOLOGIA,
): HuecoLibreDto[] {
  if (!horario.diasLaborables.includes(diaSemana)) {
    return [];
  }

  // Hoy no se ofrece lo que ya pasó: se arranca en el siguiente múltiplo del redondeo.
  const desde =
    ahoraMin === null
      ? horario.inicioMin
      : Math.max(
          horario.inicioMin,
          Math.ceil(ahoraMin / horario.redondeoMin) * horario.redondeoMin,
        );

  const bloqueos = [...ocupados].sort((a, b) => a.inicioMin - b.inicioMin);

  const huecos: HuecoLibreDto[] = [];
  let cursor = desde;
  for (const bloqueo of bloqueos) {
    agregarHueco(
      huecos,
      cursor,
      Math.min(bloqueo.inicioMin, horario.finMin),
      horario,
    );
    cursor = Math.max(cursor, bloqueo.finMin);
  }
  agregarHueco(huecos, cursor, horario.finMin, horario);
  return huecos;
}

/**
 * Horas de inicio ("HH:mm") donde cabe completa una cita de `duracionMin` dentro de los huecos,
 * alineadas al reloj cada `pasoMin` minutos (09:00, 09:30…): lo que ofrece el selector de horario.
 */
export function horasDeInicio(
  huecos: readonly HuecoLibreDto[],
  duracionMin: number,
  pasoMin: number,
): string[] {
  const horas: string[] = [];
  for (const hueco of huecos) {
    const primero = Math.ceil(hueco.desdeMin / pasoMin) * pasoMin;
    for (
      let inicio = primero;
      inicio + duracionMin <= hueco.hastaMin;
      inicio += pasoMin
    ) {
      horas.push(textoHora(inicio));
    }
  }
  return horas;
}

function textoHora(minutos: number): string {
  const hora = String(Math.floor(minutos / 60)).padStart(2, '0');
  const minuto = String(minutos % 60).padStart(2, '0');
  return `${hora}:${minuto}`;
}

function agregarHueco(
  huecos: HuecoLibreDto[],
  desdeMin: number,
  hastaMin: number,
  horario: HorarioAtencion,
): void {
  if (hastaMin - desdeMin >= horario.minimoMin) {
    huecos.push({ desdeMin, hastaMin });
  }
}
