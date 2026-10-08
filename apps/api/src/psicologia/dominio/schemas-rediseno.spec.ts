import {
  agendarCitaPsicologicaSchema,
  cerrarProcesoPsicologiaSchema,
  HORARIO_PSICOLOGIA,
  listarProcesosPsicologiaQuerySchema,
  registroConsultaSchema,
  visibilidadProcesoPsicologiaSchema,
} from '@akyuam/shared';

const sesionAtendida = {
  estado: 'ATENDIDA',
  temas: 'x',
  intervencion: '',
  recomendaciones: '',
  acuerdos: '',
  observaciones: '',
  motivoNoAsistencia: '',
};

describe('schemas del rediseño de Psicología', () => {
  describe('agendarCitaPsicologicaSchema', () => {
    it('aplica 45 minutos, la usuaria como persona atendida y sin confirmar traslape', () => {
      expect(
        agendarCitaPsicologicaSchema.parse({ fechaHora: '2026-10-07T09:00' }),
      ).toEqual({
        fechaHora: '2026-10-07T09:00',
        duracionMinutos: 45,
        ninoId: null,
        confirmarTraslape: false,
      });
    });

    it.each([30, 50, 120, 45.5])(
      'rechaza la duración %p',
      (duracionMinutos) => {
        expect(
          agendarCitaPsicologicaSchema.safeParse({
            fechaHora: '2026-10-07T09:00',
            duracionMinutos,
          }).success,
        ).toBe(false);
      },
    );

    it('rechaza un ninoId que no es UUID', () => {
      expect(
        agendarCitaPsicologicaSchema.safeParse({
          fechaHora: '2026-10-07T09:00',
          ninoId: '1 OR 1=1',
        }).success,
      ).toBe(false);
    });

    it('descarta modalidad y lugar: el cliente no decide dónde es la cita', () => {
      const datos = agendarCitaPsicologicaSchema.parse({
        fechaHora: '2026-10-07T09:00',
        modalidad: 'VIRTUAL',
        lugar: 'otro',
      });
      expect(datos).not.toHaveProperty('modalidad');
      expect(datos).not.toHaveProperty('lugar');
    });
  });

  describe('cerrarProcesoPsicologiaSchema', () => {
    it('exige resumen cuando el motivo es OTRO, sin contar espacios', () => {
      const resultado = cerrarProcesoPsicologiaSchema.safeParse({
        motivo: 'OTRO',
        resumen: '   ',
        version: 1,
      });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0].path).toEqual(['resumen']);
    });

    it('acepta un motivo de catálogo sin resumen', () => {
      expect(
        cerrarProcesoPsicologiaSchema.safeParse({
          motivo: 'OBJETIVOS_CUMPLIDOS',
          resumen: '',
          version: 3,
        }).success,
      ).toBe(true);
    });

    it('rechaza un resumen de más de 2000 caracteres y una versión ausente', () => {
      expect(
        cerrarProcesoPsicologiaSchema.safeParse({
          motivo: 'OTRO',
          resumen: 'a'.repeat(2001),
          version: 1,
        }).success,
      ).toBe(false);
      expect(
        cerrarProcesoPsicologiaSchema.safeParse({
          motivo: 'DEJO_DE_ASISTIR',
          resumen: '',
        }).success,
      ).toBe(false);
    });
  });

  it('la visibilidad no acepta apagar a Trabajo Social: ese campo no existe', () => {
    const datos = visibilidadProcesoPsicologiaSchema.parse({
      visibleJuridico: true,
      visibleMedica: false,
      visibleTs: false,
      version: 1,
    });
    expect(datos).toEqual({
      visibleJuridico: true,
      visibleMedica: false,
      version: 1,
    });
  });

  describe('"¿Qué sigue?" en el registro de sesión', () => {
    it('sigue aceptando el registro sin `siguiente`', () => {
      const datos = registroConsultaSchema.parse(sesionAtendida);
      expect(datos.siguiente).toBeUndefined();
    });

    it('PROGRAMAR exige fecha, hora y duración válidas', () => {
      expect(
        registroConsultaSchema.safeParse({
          ...sesionAtendida,
          siguiente: { tipo: 'PROGRAMAR' },
        }).success,
      ).toBe(false);
      expect(
        registroConsultaSchema.parse({
          ...sesionAtendida,
          siguiente: {
            tipo: 'PROGRAMAR',
            fechaHora: '2026-10-14T09:00',
            duracionMinutos: 60,
          },
        }).siguiente,
      ).toEqual({
        tipo: 'PROGRAMAR',
        fechaHora: '2026-10-14T09:00',
        duracionMinutos: 60,
      });
    });

    it('rechaza un tipo desconocido', () => {
      expect(
        registroConsultaSchema.safeParse({
          ...sesionAtendida,
          siguiente: { tipo: 'CERRAR_YA' },
        }).success,
      ).toBe(false);
    });
  });

  it('la lista de procesos arranca en ACTIVOS y busca desde 3 caracteres', () => {
    expect(listarProcesosPsicologiaQuerySchema.parse({}).filtro).toBe(
      'ACTIVOS',
    );
    expect(
      listarProcesosPsicologiaQuerySchema.safeParse({ q: 'ab' }).success,
    ).toBe(false);
    expect(
      listarProcesosPsicologiaQuerySchema.safeParse({ filtro: 'TODOS' })
        .success,
    ).toBe(false);
  });

  it('el horario del área es coherente', () => {
    const h = HORARIO_PSICOLOGIA;
    expect(h.inicioMin).toBeLessThan(h.almuerzoInicioMin);
    expect(h.almuerzoInicioMin).toBeLessThan(h.almuerzoFinMin);
    expect(h.almuerzoFinMin).toBeLessThan(h.finMin);
    expect(h.minimoMin % h.redondeoMin).toBe(0);
  });
});
