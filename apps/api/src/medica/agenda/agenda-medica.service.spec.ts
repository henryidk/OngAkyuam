import { PAGINA_SIN_PROXIMA_MEDICA } from '@akyuam/shared';
import type { IReloj } from '../../common/reloj';
import type {
  ILectorCitasMedicas,
  ILectorPendientesMedica,
} from '../interfaces/agenda-medica-repository.interface';
import type { ICitasMedicasRepository } from '../interfaces/citas-medicas-repository.interface';
import { AgendaMedicaService } from './agenda-medica.service';

const CONTEOS = { TODAS: 45, NO_ASISTIO: 5, SIN_FECHA: 10, SIN_VENIR: 30 };

describe('AgendaMedicaService.sinProxima', () => {
  let lector: jest.Mocked<
    Pick<ILectorPendientesMedica, 'paginaSinProxima' | 'conteosSinProxima'>
  >;
  let service: AgendaMedicaService;

  beforeEach(() => {
    lector = {
      paginaSinProxima: jest.fn().mockResolvedValue([]),
      conteosSinProxima: jest.fn().mockResolvedValue(CONTEOS),
    };
    const reloj: IReloj = { ahora: () => new Date('2027-01-10T16:00:00Z') };
    service = new AgendaMedicaService(
      {} as ILectorCitasMedicas,
      lector as unknown as ILectorPendientesMedica,
      {} as ICitasMedicasRepository,
      reloj,
    );
  });

  it('pide la página con el tamaño fijo del servidor y el total es el del grupo pedido', async () => {
    const pagina = await service.sinProxima({ grupo: 'SIN_VENIR', pagina: 2 });
    expect(pagina).toEqual({
      items: [],
      total: 30,
      pagina: 2,
      porPagina: PAGINA_SIN_PROXIMA_MEDICA,
      conteos: CONTEOS,
    });
    expect(lector.paginaSinProxima).toHaveBeenCalledWith(
      expect.objectContaining({ grupo: 'SIN_VENIR' }),
      2,
      PAGINA_SIN_PROXIMA_MEDICA,
    );
  });

  it('sin grupo, el total es el de todas', async () => {
    await expect(service.sinProxima({ pagina: 1 })).resolves.toMatchObject({
      total: 45,
    });
  });

  it('los conteos usan la misma búsqueda pero ignoran el grupo: cada chip muestra su total', async () => {
    await service.sinProxima({
      q: 'María López',
      grupo: 'NO_ASISTIO',
      pagina: 1,
    });
    const filtroPagina = lector.paginaSinProxima.mock.calls[0][0];
    expect(filtroPagina.busqueda).toEqual({
      tipo: 'nombre',
      valor: 'María López',
    });
    expect(lector.conteosSinProxima).toHaveBeenCalledWith({
      busqueda: filtroPagina.busqueda,
      corte: filtroPagina.corte,
    });
  });
});
