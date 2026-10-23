import type {
  CitaAgendaMedicaDto,
  EstadoCitaMedicaDerivado,
} from '@akyuam/shared';

/** Orden en que la médica atiende: lo que está pasando, lo que ya se pasó, lo que viene. */
const PRIORIDAD_POR_ATENDER: Partial<Record<EstadoCitaMedicaDerivado, number>> =
  {
    EN_CURSO: 0,
    SIN_REGISTRAR: 1,
    PROGRAMADA: 2,
  };

/** Estados que todavía piden algo de la médica: registrar la consulta o la inasistencia. */
export function esPorAtender(estado: EstadoCitaMedicaDerivado): boolean {
  return estado in PRIORIDAD_POR_ATENDER;
}

/**
 * Las citas por atender, en curso primero y luego por hora. Las atendidas, inasistencias y
 * canceladas quedan fuera: ya no piden nada.
 */
export function ordenarPorAtender(
  citas: CitaAgendaMedicaDto[],
): CitaAgendaMedicaDto[] {
  return citas
    .filter((cita) => esPorAtender(cita.estadoVista))
    .sort(
      (a, b) =>
        PRIORIDAD_POR_ATENDER[a.estadoVista]! -
          PRIORIDAD_POR_ATENDER[b.estadoVista]! ||
        a.inicio.localeCompare(b.inicio),
    );
}
