import {
  agendarAudienciaSchema,
  asignarNumeroJudicialSchema,
  cancelarAudienciaSchema,
  fechaHoraLocalSchema,
  listarAudienciasQuerySchema,
  registrarResultadoAudienciaSchema,
  reprogramarAudienciaSchema,
} from '@akyuam/shared';

const RESPONSABLE = '11111111-1111-4111-8111-111111111111';

describe('schemas de audiencias de Jurídico (planaudiencias.md §5 y §7.2)', () => {
  describe('fechaHoraLocalSchema', () => {
    it('acepta fecha y hora en minutos exactos', () => {
      expect(fechaHoraLocalSchema.safeParse('2026-10-21T09:30').success).toBe(
        true,
      );
    });

    it.each([
      '2026-02-30T09:00', // día que no existe
      '2026-10-21T25:00', // hora que no existe
      '2026-10-21T09:30:15', // con segundos: "la misma hora" dejaría de ser el mismo minuto
      '2026-10-21 09:30',
      '21/10/2026 09:30',
      '',
    ])('rechaza %p', (valor) => {
      expect(fechaHoraLocalSchema.safeParse(valor).success).toBe(false);
    });
  });

  describe('agendarAudienciaSchema', () => {
    it('aplica los valores por defecto: sin descripción, sin No. judicial, sin enlace', () => {
      expect(
        agendarAudienciaSchema.parse({
          fechaHora: '2026-10-21T09:30',
          responsableId: RESPONSABLE,
        }),
      ).toEqual({
        fechaHora: '2026-10-21T09:30',
        responsableId: RESPONSABLE,
        descripcion: '',
        numeroJudicial: null,
        reprogramadaDesdeId: null,
      });
    });

    it('normaliza el No. judicial y trata el vacío como "no se captura ahora"', () => {
      const base = {
        fechaHora: '2026-10-21T09:30',
        responsableId: RESPONSABLE,
      };
      expect(
        agendarAudienciaSchema.parse({
          ...base,
          numeroJudicial: '  C-01  2026 ',
        }).numeroJudicial,
      ).toBe('C-01 2026');
      expect(
        agendarAudienciaSchema.parse({ ...base, numeroJudicial: '   ' })
          .numeroJudicial,
      ).toBeNull();
    });

    it('exige responsable', () => {
      expect(
        agendarAudienciaSchema.safeParse({ fechaHora: '2026-10-21T09:30' })
          .success,
      ).toBe(false);
    });
  });

  it('reprogramar y cancelar exigen motivo', () => {
    expect(
      reprogramarAudienciaSchema.safeParse({
        fechaHora: '2026-10-21T09:30',
        responsableId: RESPONSABLE,
        motivo: '   ',
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      cancelarAudienciaSchema.safeParse({ motivo: '', version: 1 }).success,
    ).toBe(false);
  });

  describe('registrarResultadoAudienciaSchema', () => {
    it('"Se realizó" no exige motivo', () => {
      expect(
        registrarResultadoAudienciaSchema.safeParse({
          resultado: 'REALIZADA',
          observaciones: 'Se presentaron ambas partes',
          version: 1,
        }).success,
      ).toBe(true);
    });

    it('"Se realizó" exige observaciones', () => {
      const resultado = registrarResultadoAudienciaSchema.safeParse({
        resultado: 'REALIZADA',
        observaciones: '  ',
        version: 1,
      });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0].path).toEqual(['observaciones']);
    });

    it('"No se realizó" exige motivo', () => {
      const resultado = registrarResultadoAudienciaSchema.safeParse({
        resultado: 'NO_REALIZADA',
        motivo: ' ',
        version: 1,
      });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0].path).toEqual(['motivo']);
    });

    it('no acepta estados que no son resultado', () => {
      expect(
        registrarResultadoAudienciaSchema.safeParse({
          resultado: 'CANCELADA',
          version: 1,
        }).success,
      ).toBe(false);
    });
  });

  it('asignar No. judicial: no acepta vacío ni más de 60 caracteres', () => {
    expect(
      asignarNumeroJudicialSchema.safeParse({
        numeroJudicial: '  ',
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      asignarNumeroJudicialSchema.safeParse({
        numeroJudicial: 'x'.repeat(61),
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      asignarNumeroJudicialSchema.parse({ numeroJudicial: 'C-01', version: 1 })
        .confirmarNumeroRepetido,
    ).toBe(false);
  });

  describe('listarAudienciasQuerySchema', () => {
    it('por defecto muestra las próximas sin rango de fechas', () => {
      expect(listarAudienciasQuerySchema.parse({})).toEqual({
        vista: 'proximas',
        page: 1,
      });
    });

    it('el Historial exige Desde y Hasta', () => {
      expect(
        listarAudienciasQuerySchema.safeParse({ vista: 'historial' }).success,
      ).toBe(false);
    });

    it.each([
      ['2026-01-01', '2026-12-31', true],
      ['2026-01-01', '2027-01-02', true], // 366 días
      ['2026-01-01', '2027-01-03', false], // más de un año
      ['2026-05-10', '2026-05-09', false], // al revés
    ])('Historial %p → %p: válido = %p', (desde, hasta, valido) => {
      expect(
        listarAudienciasQuerySchema.safeParse({
          vista: 'historial',
          desde,
          hasta,
        }).success,
      ).toBe(valido);
    });

    it('"mias" llega como texto en la query', () => {
      expect(listarAudienciasQuerySchema.parse({ mias: 'false' }).mias).toBe(
        false,
      );
    });
  });
});
