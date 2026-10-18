import {
  agendarCitaPsicologicaSchema,
  moverCitaPsicologicaSchema,
  siguientePasoSesionSchema,
  registroConsultaSchema,
} from '@akyuam/shared';
import { rangoPsicologia, resumirPeriodo } from './indicadores';
import { validarHorarioPsicologia } from '../compartido/validar-horario';

describe('horario laboral de Psicología', () => {
  it.each(['02:00', '07:59', '16:16', '17:00', '23:00'])(
    'rechaza %s con 45 minutos en todas las formas de agendar',
    (hora) => {
      const datos = { fechaHora: `2026-10-20T${hora}`, duracionMinutos: 45 };
      expect(agendarCitaPsicologicaSchema.safeParse(datos).success).toBe(false);
      expect(moverCitaPsicologicaSchema.safeParse(datos).success).toBe(false);
      expect(
        siguientePasoSesionSchema.safeParse({ ...datos, tipo: 'PROGRAMAR' })
          .success,
      ).toBe(false);
      expect(() => validarHorarioPsicologia(datos.fechaHora, 45)).toThrow();
    },
  );
  it.each([
    ['08:00', 45],
    ['16:15', 45],
    ['15:30', 90],
    ['16:00', 60],
  ])(
    'acepta %s y %i minutos si termina a más tardar a las 17',
    (hora, duracion) => {
      expect(
        agendarCitaPsicologicaSchema.safeParse({
          fechaHora: `2026-10-20T${hora}`,
          duracionMinutos: duracion,
        }).success,
      ).toBe(true);
    },
  );
});

describe('rangos de edad del informe', () => {
  it.each([
    [0, '0_15'],
    [15, '0_15'],
    [16, '16_30'],
    [30, '16_30'],
    [31, '31_45'],
    [45, '31_45'],
    [46, '46_MAS'],
    [90, '46_MAS'],
  ])('clasifica %i en %s', (edad, rango) =>
    expect(rangoPsicologia(Number(edad))).toBe(rango),
  );
  it('muestra todos los rangos y municipios aun sin atenciones', () => {
    const periodo = resumirPeriodo([]);
    expect(periodo.desgloses.rangoEdad.map((r) => r.etiqueta)).toEqual([
      '0–15',
      '16–30',
      '31–45',
      '46 y más',
    ]);
    expect(periodo.desgloses.municipio.length).toBeGreaterThan(1);
    expect(periodo.desgloses.rangoEdadHombres).toHaveLength(4);
    expect(periodo.desgloses.rangoEdadMujeres).toHaveLength(4);
  });
});

describe('clínica y enfoque terapéutico de la sesión', () => {
  const base = {
    estado: 'ATENDIDA',
    temas: '',
    intervencion: '',
    recomendaciones: '',
    acuerdos: '',
    observaciones: '',
    motivoNoAsistencia: '',
    enfoqueTerapeutico: 'Humanista',
  };
  it('exige una clínica al finalizar una sesión atendida', () =>
    expect(registroConsultaSchema.safeParse(base).success).toBe(false));
  it.each(['Clínica 1', 'Clínica 2'])(
    'acepta %s y conserva el enfoque',
    (clinica) =>
      expect(
        registroConsultaSchema.parse({ ...base, clinica }).enfoqueTerapeutico,
      ).toBe('Humanista'),
  );
  it('permite guardar un borrador sin clínica', () =>
    expect(
      registroConsultaSchema.safeParse({ ...base, borrador: true }).success,
    ).toBe(true));
});
