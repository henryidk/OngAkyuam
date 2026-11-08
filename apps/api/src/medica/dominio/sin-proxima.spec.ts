import {
  dejoDeVenirMedica,
  fechaCalendarioGT,
  inicioDiaGT,
  sumarDiasGT,
} from '@akyuam/shared';
import { corteSinVenir } from './sin-proxima';

/** Todos los días entre dos fechas, incluidas. */
function dias(desde: string, hasta: string): string[] {
  const lista: string[] = [];
  for (let dia = desde; dia <= hasta; dia = sumarDiasGT(dia, 1)) {
    lista.push(dia);
  }
  return lista;
}

describe('corteSinVenir', () => {
  it('es hoy menos 2 meses, y el instante es el inicio del día siguiente en Guatemala', () => {
    expect(corteSinVenir(new Date('2027-01-10T16:00:00Z'))).toEqual({
      fecha: '2026-11-10',
      instante: new Date('2026-11-11T06:00:00Z'),
    });
  });

  it('a las 23:30 de Guatemala (ya otro día en UTC) el corte sigue siendo el de ese día', () => {
    // 10 de enero 23:30 en Guatemala = 11 de enero 05:30 UTC.
    expect(corteSinVenir(new Date('2027-01-11T05:30:00Z')).fecha).toBe(
      '2026-11-10',
    );
  });

  // El SQL compara instantes con `instante` y fechas de inicio con `fecha`: para cualquier hoy y
  // cualquier día, las dos comparaciones dan lo mismo que `dejoDeVenirMedica`, incluso a fin de
  // mes (31 de diciembre menos 2 meses) y en años bisiestos.
  it.each([
    '2027-02-28',
    '2028-02-29',
    '2027-03-31',
    '2027-05-31',
    '2027-12-31',
  ])(
    'coincide con dejoDeVenirMedica para todo día del último año visto desde %s',
    (hoy) => {
      const corte = corteSinVenir(inicioDiaGT(hoy));
      for (const dia of dias(sumarDiasGT(hoy, -365), hoy)) {
        const esperado = dejoDeVenirMedica(dia, hoy);
        expect(dia <= corte.fecha).toBe(esperado);
        // El último minuto del día en Guatemala, comparado como instante.
        const finDia = new Date(
          inicioDiaGT(sumarDiasGT(dia, 1)).getTime() - 60_000,
        );
        expect(fechaCalendarioGT(finDia)).toBe(dia);
        expect(finDia < corte.instante).toBe(esperado);
        expect(inicioDiaGT(dia) < corte.instante).toBe(esperado);
      }
    },
  );
});
