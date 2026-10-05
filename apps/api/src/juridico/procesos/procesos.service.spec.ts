/* eslint-disable @typescript-eslint/unbound-method */
import { listarProcesosQuerySchema } from '@akyuam/shared';
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

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    procesosRepository.listar.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    service = new ProcesosService(
      procesosRepository,
      {} as IBitacoraRepository,
      {} as ICarpetasRepository,
      crearAcceso(procesosRepository),
      {} as AsignacionPersonalService,
      crearAuditService(),
    );
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
});
