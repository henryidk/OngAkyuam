/* eslint-disable @typescript-eslint/unbound-method */
import { FILAS_AGENDA_INICIO, finDiaGT } from '@akyuam/shared';
import type { IReloj } from '../../common/reloj';
import type { IAgendaAudienciasRepository } from '../interfaces/agenda-audiencias-repository.interface';
import type { IInicioRepository } from '../interfaces/inicio-repository.interface';
import { InicioJuridicoService } from './inicio-juridico.service';

/** Viernes 30/10/2026 a las 23:30 en Guatemala: en UTC ya es sábado. */
const AHORA = new Date('2026-10-31T05:30:00.000Z');

describe('InicioJuridicoService', () => {
  let inicioRepository: jest.Mocked<IInicioRepository>;
  let agendaRepository: jest.Mocked<IAgendaAudienciasRepository>;
  let reloj: IReloj;
  let service: InicioJuridicoService;

  beforeEach(() => {
    inicioRepository = {
      indicadores: jest.fn().mockResolvedValue({
        cargaActual: {
          enTramite: 0,
          suspendidos: 0,
          abandonados: 0,
          enTramiteDeSeguimiento: 0,
        },
        movimientoAnio: {
          abiertos: 0,
          finalizados: 0,
          porMes: [],
          finalizadosPorForma: {
            CONVENIO: 0,
            SENTENCIA: 0,
            DESISTIMIENTO: 0,
            OTROS: 0,
          },
        },
      }),
      enTramitePorTipo: jest.fn().mockResolvedValue([]),
    };
    agendaRepository = {
      listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listarOcupadas: jest.fn(),
      listarPorProceso: jest.fn(),
    };
    reloj = { ahora: () => AHORA };
    service = new InicioJuridicoService(
      inicioRepository,
      agendaRepository,
      reloj,
    );
  });

  it('el año y el día salen del reloj en Guatemala, no en UTC', async () => {
    const inicio = await service.obtener();

    expect(inicio.anio).toBe(2026);
    expect(inicioRepository.indicadores).toHaveBeenCalledWith(2026);
    expect(agendaRepository.listar).toHaveBeenCalledWith({
      vista: 'proximas',
      hasta: finDiaGT('2026-10-30'),
      page: 1,
      pageSize: 1,
      ahora: AHORA,
    });
  });

  it('el 31 de diciembre por la noche todavía cuenta el año que termina', async () => {
    reloj.ahora = () => new Date('2027-01-01T03:00:00.000Z');

    const inicio = await service.obtener();

    expect(inicio.anio).toBe(2026);
    expect(inicioRepository.indicadores).toHaveBeenCalledWith(2026);
  });

  it('la agenda son las próximas sin límite de fecha; los pendientes, las que ya pasaron', async () => {
    await service.obtener();

    expect(agendaRepository.listar).toHaveBeenCalledWith({
      vista: 'proximas',
      page: 1,
      pageSize: FILAS_AGENDA_INICIO,
      ahora: AHORA,
    });
    expect(agendaRepository.listar).toHaveBeenCalledWith({
      vista: 'pendientes',
      page: 1,
      pageSize: 1,
      ahora: AHORA,
    });
  });

  it('de las de hoy y de las pendientes de resultado solo devuelve el total', async () => {
    agendaRepository.listar.mockImplementation((params) =>
      Promise.resolve({
        items: [],
        total:
          params.vista === 'pendientes' ? 8 : params.pageSize === 1 ? 2 : 9,
      }),
    );

    const { audiencias } = await service.obtener();

    expect(audiencias.restantesHoy).toBe(2);
    expect(audiencias.pendientesResultado).toBe(8);
    expect(audiencias.agenda.total).toBe(9);
  });
});
