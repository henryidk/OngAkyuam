import { nombreProfesional } from './indicadores';

describe('nombreProfesional (columna "Responsable" del Excel)', () => {
  it('la psicóloga titulada sale como licenciada', () => {
    expect(
      nombreProfesional({
        nombreCompleto: 'Ana Ficticia',
        puesto: 'PSICOLOGA',
      }),
    ).toBe('Ana Ficticia (licenciada)');
  });

  it('la practicante sale como practicante', () => {
    expect(
      nombreProfesional({
        nombreCompleto: 'Luz Ficticia',
        puesto: 'PRACTICANTE',
      }),
    ).toBe('Luz Ficticia (practicante)');
  });

  it('sin puesto sale solo el nombre, sin inventar un cargo', () => {
    expect(
      nombreProfesional({ nombreCompleto: 'Eva Ficticia', puesto: null }),
    ).toBe('Eva Ficticia');
  });
});
