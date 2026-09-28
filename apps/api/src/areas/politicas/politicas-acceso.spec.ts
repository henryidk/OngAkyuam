import { PoliticasAcceso } from './politicas-acceso';

describe('PoliticasAcceso', () => {
  const politicas = new PoliticasAcceso();

  describe('Jurídico', () => {
    const juridico = politicas.para('JURIDICO');

    it('no es restringible', () => {
      expect(juridico.esRestringible()).toBe(false);
    });

    it('ve los datos del caso aunque el referido los tenga desactivados', () => {
      expect(juridico.puedeVerDatosCaso({ puedeVerDatosCaso: false })).toBe(
        true,
      );
    });

    it('ve los formularios de Trabajo Social sin visibilidad explícita', () => {
      expect(
        juridico.puedeVerDocumento({
          tipo: 'ENTREVISTA_USUARIA',
          areasVisibles: [],
        }),
      ).toBe(true);
    });

    it('no ve documentos de otras áreas sin visibilidad explícita', () => {
      expect(
        juridico.puedeVerDocumento({
          tipo: 'FORMATO_ATENCION_PSICOLOGICA',
          areasVisibles: ['PSICOLOGIA'],
        }),
      ).toBe(false);
    });
  });

  describe.each(['PSICOLOGIA', 'MEDICA'] as const)('%s', (area) => {
    const politica = politicas.para(area);

    it('es restringible', () => {
      expect(politica.esRestringible()).toBe(true);
    });

    it('respeta puedeVerDatosCaso del referido', () => {
      expect(politica.puedeVerDatosCaso({ puedeVerDatosCaso: false })).toBe(
        false,
      );
      expect(politica.puedeVerDatosCaso({ puedeVerDatosCaso: true })).toBe(
        true,
      );
    });

    it('solo ve documentos con visibilidad otorgada a su área', () => {
      expect(
        politica.puedeVerDocumento({
          tipo: 'ENTREVISTA_USUARIA',
          areasVisibles: [],
        }),
      ).toBe(false);
      expect(
        politica.puedeVerDocumento({
          tipo: 'ENTREVISTA_USUARIA',
          areasVisibles: [
            'JURIDICO',
            area === 'MEDICA' ? 'PSICOLOGIA' : 'MEDICA',
          ],
        }),
      ).toBe(false);
      expect(
        politica.puedeVerDocumento({
          tipo: 'ENTREVISTA_USUARIA',
          areasVisibles: [area],
        }),
      ).toBe(true);
    });
  });
});
