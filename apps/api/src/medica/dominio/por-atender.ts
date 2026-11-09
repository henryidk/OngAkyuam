import {
  citaPorRegistrar,
  type CitaAgendaMedicaDto,
  type EstadoCitaMedicaDerivado,
} from '@akyuam/shared';

/** Lo que está pasando primero y luego lo que ya terminó sin registro. */
const PRIORIDAD: Partial<Record<EstadoCitaMedicaDerivado, number>> = {
  EN_CURSO: 0,
  SIN_REGISTRAR: 1,
};

/** Cita de Consultas › Por registrar: la misma regla que Psicología (`citaPorRegistrar`). */
export function esPorRegistrar(
  cita: Pick<CitaAgendaMedicaDto, 'estado' | 'inicio'>,
  ahora: Date,
): boolean {
  return citaPorRegistrar(
    { programada: cita.estado === 'PROGRAMADA', inicio: cita.inicio },
    ahora,
  );
}

/**
 * Las citas de hoy por registrar: la en curso primero y luego por hora. Las que todavía no
 * empiezan se registran desde la Agenda; las atendidas, inasistencias y canceladas ya no piden
 * nada.
 */
export function ordenarPorRegistrar(
  citas: CitaAgendaMedicaDto[],
  ahora: Date,
): CitaAgendaMedicaDto[] {
  return citas
    .filter((cita) => esPorRegistrar(cita, ahora))
    .sort(
      (a, b) =>
        (PRIORIDAD[a.estadoVista] ?? 1) - (PRIORIDAD[b.estadoVista] ?? 1) ||
        a.inicio.localeCompare(b.inicio),
    );
}
