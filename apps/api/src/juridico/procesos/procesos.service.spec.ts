/* eslint-disable @typescript-eslint/unbound-method */
import { listarProcesosQuerySchema } from '@akyuam/shared';
import type { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';
import {
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
  relojFijo,
} from '../pruebas/dobles';
import { ProcesosService } from './procesos.service';

const CUENTA_ID = '77777777-7777-4777-8777-777777777777';

describe('ProcesosService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let service: ProcesosService;

  function crearService(ahora?: Date): ProcesosService {
    return new ProcesosService(
      procesosRepository,
      {} as IBitacoraRepository,
      {} as ICarpetasRepository,
      crearAcceso(procesosRepository),
      {} as AsignacionPersonalService,
      crearAuditService(),
      relojFijo(ahora),
    );
  }

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    procesosRepository.listar.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    service = crearService();
  });

  describe('listar', () => {
    it('"Solo asignados a mí" filtra por la cuenta que consulta', async () => {
      await service.listar(
        listarProcesosQuerySchema.parse({ mios: 'true' }),
        CUENTA_ID,
      );

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ asignadosAUsuarioId: CUENTA_ID }),
      );
    });

    it('sin el filtro no restringe por asignación', async () => {
      await service.listar(listarProcesosQuerySchema.parse({}), CUENTA_ID);

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ asignadosAUsuarioId: undefined }),
      );
    });

    it('mios=false tampoco restringe', async () => {
      await service.listar(
        listarProcesosQuerySchema.parse({ mios: 'false' }),
        CUENTA_ID,
      );

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ asignadosAUsuarioId: undefined }),
      );
    });
  });

  describe('cartera', () => {
    it('sin filtro pide todas, con el año en curso de Guatemala', async () => {
      await service.listar(listarProcesosQuerySchema.parse({}), CUENTA_ID);

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ cartera: 'TODOS', anioActual: 2026 }),
      );
    });

    it('pasa la cartera elegida', async () => {
      await service.listar(
        listarProcesosQuerySchema.parse({ cartera: 'SEGUIMIENTO' }),
        CUENTA_ID,
      );

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ cartera: 'SEGUIMIENTO' }),
      );
    });

    it('rechaza una cartera que no existe', () => {
      expect(() =>
        listarProcesosQuerySchema.parse({ cartera: 'OTRA' }),
      ).toThrow();
    });

    it('el 31/12 a las 21:00 de Guatemala sigue siendo el año que termina, aunque en UTC ya es el siguiente', async () => {
      procesosRepository.resumen.mockResolvedValue(
        {} as Awaited<ReturnType<typeof procesosRepository.resumen>>,
      );
      await crearService(new Date('2027-01-01T03:00:00.000Z')).resumen();

      expect(procesosRepository.resumen).toHaveBeenCalledWith(2026);
    });
  });
});
