import type {
  CitaAgendaMedicaDto,
  EstadoCitaMedicaDerivado,
} from '@akyuam/shared';
import { esPorAtender, ordenarPorAtender } from './por-atender';

function cita(
  id: string,
  estadoVista: EstadoCitaMedicaDerivado,
  inicio: string,
): CitaAgendaMedicaDto {
  return { id, estadoVista, inicio } as CitaAgendaMedicaDto;
}

describe('por atender (planconsultasmedica.md §3.1)', () => {
  it.each([
    ['PROGRAMADA', true],
    ['EN_CURSO', true],
    ['SIN_REGISTRAR', true],
    ['ATENDIDA', false],
    ['NO_ASISTIO', false],
    ['CANCELADA', false],
  ] as const)('%s → por atender = %p', (estado, esperado) => {
    expect(esPorAtender(estado)).toBe(esperado);
  });

  it('pone primero la que está en curso, luego las pasadas sin registrar y luego por hora', () => {
    const citas = [
      cita('programada-11', 'PROGRAMADA', '2026-10-14T17:00:00.000Z'),
      cita('atendida', 'ATENDIDA', '2026-10-14T14:00:00.000Z'),
      cita('sin-registrar', 'SIN_REGISTRAR', '2026-10-14T14:30:00.000Z'),
      cita('programada-10', 'PROGRAMADA', '2026-10-14T16:00:00.000Z'),
      cita('en-curso', 'EN_CURSO', '2026-10-14T15:30:00.000Z'),
      cita('no-asistio', 'NO_ASISTIO', '2026-10-14T13:00:00.000Z'),
    ];
    expect(ordenarPorAtender(citas).map((c) => c.id)).toEqual([
      'en-curso',
      'sin-registrar',
      'programada-10',
      'programada-11',
    ]);
  });
});
