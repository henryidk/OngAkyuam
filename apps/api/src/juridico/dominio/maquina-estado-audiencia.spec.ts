import { parseLocalGT } from '@akyuam/shared';
import {
  accionesDisponiblesAudiencia,
  puedeAplicarAudiencia,
  type EstadoAudienciaActual,
} from './maquina-estado-audiencia';

const ahora = parseLocalGT('2026-10-21T10:00');
const FUTURA = parseLocalGT('2026-10-22T09:00');
const PASADA = parseLocalGT('2026-10-20T09:00');

function audiencia(
  parcial: Partial<EstadoAudienciaActual> = {},
): EstadoAudienciaActual {
  return {
    estado: 'PROGRAMADA',
    inicio: FUTURA,
    tieneNuevaFecha: false,
    procesoAbierto: true,
    ...parcial,
  };
}

describe('máquina de estados de la audiencia', () => {
  it('una programada futura se reprograma, cambia de responsable, se cancela y recibe documentos', () => {
    expect(accionesDisponiblesAudiencia(audiencia(), ahora)).toEqual([
      'REPROGRAMAR',
      'CAMBIAR_RESPONSABLE',
      'CANCELAR',
      'ADJUNTAR_DOCUMENTO',
    ]);
  });

  it('el resultado solo se registra cuando la audiencia ya empezó', () => {
    expect(
      puedeAplicarAudiencia('REGISTRAR_RESULTADO', audiencia(), ahora),
    ).toBe(false);
    expect(
      puedeAplicarAudiencia(
        'REGISTRAR_RESULTADO',
        audiencia({ inicio: ahora }),
        ahora,
      ),
    ).toBe(true);
    expect(
      puedeAplicarAudiencia(
        'REGISTRAR_RESULTADO',
        audiencia({ inicio: PASADA }),
        ahora,
      ),
    ).toBe(true);
  });

  it('con el proceso cerrado ya no se mueve la agenda, pero sí se deja constancia', () => {
    const cerrado = audiencia({ inicio: PASADA, procesoAbierto: false });
    expect(accionesDisponiblesAudiencia(cerrado, ahora)).toEqual([
      'CANCELAR',
      'REGISTRAR_RESULTADO',
      'ADJUNTAR_DOCUMENTO',
    ]);
  });

  it.each(['REALIZADA', 'NO_REALIZADA'] as const)(
    '%s admite observaciones y documentos',
    (estado) => {
      const acciones = accionesDisponiblesAudiencia(
        audiencia({ estado, inicio: PASADA }),
        ahora,
      );
      expect(acciones).toContain('EDITAR_OBSERVACIONES');
      expect(acciones).toContain('ADJUNTAR_DOCUMENTO');
      expect(acciones).not.toContain('REPROGRAMAR');
      expect(acciones).not.toContain('REGISTRAR_RESULTADO');
    },
  );

  it.each(['CANCELADA', 'NO_REALIZADA'] as const)(
    '%s ofrece agendar nueva fecha una sola vez y solo con el proceso abierto',
    (estado) => {
      const base = audiencia({ estado, inicio: PASADA });
      expect(puedeAplicarAudiencia('AGENDAR_NUEVA_FECHA', base, ahora)).toBe(
        true,
      );
      expect(
        puedeAplicarAudiencia(
          'AGENDAR_NUEVA_FECHA',
          { ...base, tieneNuevaFecha: true },
          ahora,
        ),
      ).toBe(false);
      expect(
        puedeAplicarAudiencia(
          'AGENDAR_NUEVA_FECHA',
          { ...base, procesoAbierto: false },
          ahora,
        ),
      ).toBe(false);
    },
  );

  it('una reprogramada no admite nada: lo vigente es la nueva fecha', () => {
    expect(
      accionesDisponiblesAudiencia(
        audiencia({ estado: 'REPROGRAMADA', tieneNuevaFecha: true }),
        ahora,
      ),
    ).toEqual([]);
  });

  it('una cancelada no recibe documentos ni observaciones', () => {
    expect(
      accionesDisponiblesAudiencia(
        audiencia({ estado: 'CANCELADA', inicio: PASADA }),
        ahora,
      ),
    ).toEqual(['AGENDAR_NUEVA_FECHA']);
  });
});
