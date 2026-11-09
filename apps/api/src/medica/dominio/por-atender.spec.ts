import type {
  CitaAgendaMedicaDto,
  EstadoCitaMedica,
  EstadoCitaMedicaDerivado,
} from '@akyuam/shared';
import { esPorRegistrar, ordenarPorRegistrar } from './por-atender';

// Miércoles 14/10/2026, 09:00 en Guatemala (UTC-6).
const AHORA = new Date('2026-10-14T15:00:00.000Z');

function cita(
  id: string,
  estado: EstadoCitaMedica,
  estadoVista: EstadoCitaMedicaDerivado,
  inicio: string,
): CitaAgendaMedicaDto {
  return { id, estado, estadoVista, inicio } as CitaAgendaMedicaDto;
}

describe('Consultas › Por registrar de Medicina', () => {
  it.each([
    [
      'programada que ya empezó',
      'PROGRAMADA',
      '2026-10-14T14:30:00.000Z',
      true,
    ],
    [
      'programada que empieza justo ahora',
      'PROGRAMADA',
      '2026-10-14T15:00:00.000Z',
      true,
    ],
    [
      'programada de más tarde hoy',
      'PROGRAMADA',
      '2026-10-14T17:00:00.000Z',
      false,
    ],
    ['atendida', 'ATENDIDA', '2026-10-14T13:00:00.000Z', false],
    ['inasistencia', 'NO_ASISTIO', '2026-10-14T13:00:00.000Z', false],
    ['cancelada', 'CANCELADA', '2026-10-14T13:00:00.000Z', false],
  ] as const)('%s → %p', (_caso, estado, inicio, esperado) => {
    expect(esPorRegistrar({ estado, inicio }, AHORA)).toBe(esperado);
  });

  it('pone primero la que está en curso, luego las terminadas por hora, y deja fuera lo que aún no empieza', () => {
    const citas = [
      cita(
        'programada-11',
        'PROGRAMADA',
        'PROGRAMADA',
        '2026-10-14T17:00:00.000Z',
      ),
      cita('atendida', 'ATENDIDA', 'ATENDIDA', '2026-10-14T14:00:00.000Z'),
      cita(
        'sin-registrar-830',
        'PROGRAMADA',
        'SIN_REGISTRAR',
        '2026-10-14T14:30:00.000Z',
      ),
      cita(
        'sin-registrar-700',
        'PROGRAMADA',
        'SIN_REGISTRAR',
        '2026-10-14T13:00:00.000Z',
      ),
      cita('en-curso', 'PROGRAMADA', 'EN_CURSO', '2026-10-14T14:50:00.000Z'),
      cita(
        'no-asistio',
        'NO_ASISTIO',
        'NO_ASISTIO',
        '2026-10-14T13:00:00.000Z',
      ),
    ];
    expect(ordenarPorRegistrar(citas, AHORA).map((c) => c.id)).toEqual([
      'en-curso',
      'sin-registrar-700',
      'sin-registrar-830',
    ]);
  });
});
