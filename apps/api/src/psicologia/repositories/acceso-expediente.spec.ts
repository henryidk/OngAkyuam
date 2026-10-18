import {
  expedienteAccesible,
  procesoLegible,
  PROCESO_POR_REASIGNAR,
} from './acceso-expediente';
describe('consulta compartida de Psicología', () => {
  it('todas las psicólogas leen expedientes referidos al área sin depender de su dueña ni cierre', () => {
    const referido = { referidos: { some: { area: 'PSICOLOGIA' } } };
    expect(expedienteAccesible('psicologa-a')).toEqual(referido);
    expect(expedienteAccesible('psicologa-b')).toEqual(referido);
    expect(procesoLegible('psicologa-b')).toEqual({ expediente: referido });
  });
  it('reasignar sigue limitado a procesos abiertos con responsable inactiva', () => {
    expect(PROCESO_POR_REASIGNAR).toEqual({
      estado: { not: 'CIERRE' },
      psicologaAsignada: { isActive: false },
    });
  });
});
