/* eslint-disable @typescript-eslint/unbound-method */
import { buscarProcesosSchema } from '@akyuam/shared';
import type { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';
import {
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
} from '../pruebas/dobles';
import { ProcesosService } from './procesos.service';

const CUENTA_ID = '77777777-7777-4777-8777-777777777777';

describe('ProcesosService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let service: ProcesosService;

  function crearService(): ProcesosService {
    return new ProcesosService(
      procesosRepository,
      {} as IBitacoraRepository,
      {} as ICarpetasRepository,
      crearAcceso(procesosRepository),
      {} as AsignacionPersonalService,
      crearAuditService(),
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
        buscarProcesosSchema.parse({ mios: 'true' }),
        CUENTA_ID,
      );

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ asignadosAUsuarioId: CUENTA_ID }),
      );
    });

    it('sin el filtro no restringe por asignación', async () => {
      await service.listar(buscarProcesosSchema.parse({}), CUENTA_ID);

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ asignadosAUsuarioId: undefined }),
      );
    });

    it('mios=false tampoco restringe', async () => {
      await service.listar(
        buscarProcesosSchema.parse({ mios: 'false' }),
        CUENTA_ID,
      );

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ asignadosAUsuarioId: undefined }),
      );
    });
  });

  describe('carpetas por año', () => {
    it('sin filtro pide todos los años', async () => {
      await service.listar(buscarProcesosSchema.parse({}), CUENTA_ID);

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ anio: undefined }),
      );
    });

    it('pasa la carpeta elegida (viene como texto en la URL)', async () => {
      await service.listar(
        buscarProcesosSchema.parse({ anio: '2014' }),
        CUENTA_ID,
      );

      expect(procesosRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ anio: 2014 }),
      );
    });

    it.each(['OTRA', '1989', '2101', '2014.5'])(
      'rechaza un año que no es válido: %p',
      (anio) => {
        expect(() => buscarProcesosSchema.parse({ anio })).toThrow();
      },
    );
  });
});
