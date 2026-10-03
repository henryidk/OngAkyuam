// Ver documentos.service.spec.ts: falso positivo de unbound-method con jest.Mocked<T>.
/* eslint-disable @typescript-eslint/unbound-method */
import type { AuditService } from '../../auth/services/audit.service';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import type { IDocumentosPendientesRepository } from './interfaces/documentos-pendientes-repository.interface';
import { LimpiezaDocumentosPendientesService } from './limpieza-documentos-pendientes.service';

describe('LimpiezaDocumentosPendientesService', () => {
  let service: LimpiezaDocumentosPendientesService;
  let repository: jest.Mocked<IDocumentosPendientesRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let auditService: jest.Mocked<AuditService>;

  const ahora = new Date('2026-10-02T12:00:00.000Z');

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      eliminarDeUsuario: jest.fn(),
      listarVencidos: jest.fn().mockResolvedValue([]),
      eliminar: jest.fn().mockResolvedValue(undefined),
    };
    objectStorage = {
      subirObjeto: jest.fn(),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest.fn(),
      generarUrlVistaPrevia: jest.fn(),
    };
    auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    service = new LimpiezaDocumentosPendientesService(
      repository,
      objectStorage,
      auditService,
    );
  });

  it('solo busca los subidos hace más de 24 h + 1 h de margen', async () => {
    await service.ejecutar(ahora);

    expect(repository.listarVencidos).toHaveBeenCalledWith(
      new Date('2026-10-01T11:00:00.000Z'),
      expect.any(Number),
    );
  });

  it('borra primero el objeto en R2 y luego la fila, y audita solo la cantidad', async () => {
    repository.listarVencidos.mockResolvedValueOnce([
      { id: 'p-1', claveR2: 'registro/a' },
      { id: 'p-2', claveR2: 'registro/b' },
    ]);
    const orden: string[] = [];
    objectStorage.eliminarObjeto.mockImplementation((clave) => {
      orden.push(`r2:${clave}`);
      return Promise.resolve();
    });
    repository.eliminar.mockImplementation((id) => {
      orden.push(`fila:${id}`);
      return Promise.resolve();
    });

    const borrados = await service.ejecutar(ahora);

    expect(borrados).toBe(2);
    expect(orden).toEqual([
      'r2:registro/a',
      'fila:p-1',
      'r2:registro/b',
      'fila:p-2',
    ]);
    expect(auditService.registrar).toHaveBeenCalledWith({
      accion: 'DOCUMENTOS_PENDIENTES_EXPIRADOS',
      entidad: 'DocumentoPendiente',
      detalles: { cantidad: 2 },
    });
  });

  it('si R2 falla, conserva la fila para reintentar en la próxima corrida', async () => {
    repository.listarVencidos.mockResolvedValueOnce([
      { id: 'p-1', claveR2: 'registro/a' },
      { id: 'p-2', claveR2: 'registro/b' },
    ]);
    objectStorage.eliminarObjeto.mockImplementation((clave) =>
      clave === 'registro/a'
        ? Promise.reject(new Error('R2 caído'))
        : Promise.resolve(),
    );

    const borrados = await service.ejecutar(ahora);

    expect(borrados).toBe(1);
    expect(repository.eliminar).toHaveBeenCalledTimes(1);
    expect(repository.eliminar).toHaveBeenCalledWith('p-2');
  });

  it('nunca lanza aunque falle la base, y no audita si no borró nada', async () => {
    repository.listarVencidos.mockRejectedValue(new Error('base caída'));

    await expect(service.ejecutar(ahora)).resolves.toBe(0);
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('sigue con el siguiente lote cuando el anterior venía lleno', async () => {
    const loteLleno = Array.from({ length: 100 }, (_, indice) => ({
      id: `p-${indice}`,
      claveR2: `registro/${indice}`,
    }));
    repository.listarVencidos
      .mockResolvedValueOnce(loteLleno)
      .mockResolvedValueOnce([{ id: 'p-100', claveR2: 'registro/100' }]);

    const borrados = await service.ejecutar(ahora);

    expect(borrados).toBe(101);
    expect(repository.listarVencidos).toHaveBeenCalledTimes(2);
  });
});
