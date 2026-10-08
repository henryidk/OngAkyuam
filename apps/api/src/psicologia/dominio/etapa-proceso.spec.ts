import {
  accionesDisponibles,
  citaSinRegistrar,
  estaCerrado,
  etapaTrasSesionAtendida,
} from './etapa-proceso';

describe('reglas de etapa del proceso psicológico', () => {
  it('la primera sesión atendida pasa de Inicio a Seguimiento y ahí se queda', () => {
    expect(etapaTrasSesionAtendida('INICIO')).toBe('SEGUIMIENTO');
    expect(etapaTrasSesionAtendida('SEGUIMIENTO')).toBe('SEGUIMIENTO');
  });

  it('una sesión atendida nunca reabre un proceso cerrado', () => {
    expect(etapaTrasSesionAtendida('CIERRE')).toBe('CIERRE');
  });

  it('solo CIERRE cuenta como cerrado', () => {
    expect(estaCerrado('CIERRE')).toBe(true);
    expect(estaCerrado('INICIO')).toBe(false);
    expect(estaCerrado('SEGUIMIENTO')).toBe(false);
  });

  it('un proceso cerrado solo permite corregir la visibilidad', () => {
    expect(accionesDisponibles('CIERRE')).toEqual(['EDITAR_VISIBILIDAD']);
    expect(accionesDisponibles('INICIO')).toEqual(
      expect.arrayContaining(['PROGRAMAR_CITA', 'REGISTRAR_SESION', 'CERRAR']),
    );
  });

  describe('citaSinRegistrar', () => {
    const cita = {
      estado: 'PROGRAMADA' as const,
      fechaHora: new Date('2026-10-07T15:00:00.000Z'),
      duracionMinutos: 45,
    };

    it('no lo está mientras la cita no haya terminado', () => {
      expect(citaSinRegistrar(cita, new Date('2026-10-07T15:44:00.000Z'))).toBe(
        false,
      );
    });

    it('lo está desde que termina su horario', () => {
      expect(citaSinRegistrar(cita, new Date('2026-10-07T15:45:00.000Z'))).toBe(
        true,
      );
    });

    it.each(['ATENDIDA', 'NO_ASISTIO', 'CANCELADA', 'REPROGRAMADA'] as const)(
      'una cita %s ya está resuelta aunque haya pasado',
      (estado) => {
        expect(
          citaSinRegistrar(
            { ...cita, estado },
            new Date('2026-10-08T15:00:00.000Z'),
          ),
        ).toBe(false);
      },
    );
  });
});
