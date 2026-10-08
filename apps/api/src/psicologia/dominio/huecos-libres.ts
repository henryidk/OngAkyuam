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
  readonly almuerzoInicioMin: number;
  readonly almuerzoFinMin: number;
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

  const bloqueos = [
    ...ocupados,
    { inicioMin: horario.almuerzoInicioMin, finMin: horario.almuerzoFinMin },
  ].sort((a, b) => a.inicioMin - b.inicioMin);

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
