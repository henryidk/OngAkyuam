import type { PrismaService } from '../../prisma/prisma.service';
import {
  DocumentoPendienteNoAplicaError,
  DocumentoPendienteNoDisponibleError,
  type DatosCasoParams,
} from '../interfaces/expedientes-repository.interface';
import { ExpedientesRepository } from './expedientes.repository';

/**
 * Solo la parte de adjuntar documentos ya subidos al crear un caso: quién puede adjuntar qué es
 * lógica de autorización (un escaneo de una sobreviviente no puede terminar en el caso de otra).
 */
describe('ExpedientesRepository — documentos pendientes al crear un caso', () => {
  const ahora = new Date('2026-10-02T12:00:00.000Z');

  function pendiente(id: string, tipo: string) {
    return {
      id,
      tipo,
      nombreArchivo: `${id}.pdf`,
      claveR2: `registro/${id}`,
      mimeType: 'application/pdf',
      tamanioBytes: 1024,
      subidoPorId: 'ts-1',
      createdAt: ahora,
    };
  }

  function crearTx(pendientes: ReturnType<typeof pendiente>[]) {
    return {
      usuaria: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u-1',
          nombres: 'Ana',
          apellidos: 'Ficticia',
          municipio: 'COBAN',
        }),
      },
      expedienteContador: {
        upsert: jest.fn().mockResolvedValue({ ultimo: 3 }),
      },
      expediente: {
        create: jest.fn().mockResolvedValue({
          id: 'exp-1',
          numero: '03-2026',
          tipoRegistro: 'EXTERNA',
        }),
      },
      documentoPendiente: {
        findMany: jest.fn().mockResolvedValue(pendientes),
        deleteMany: jest.fn().mockResolvedValue({ count: pendientes.length }),
      },
      documento: {
        createManyAndReturn: jest.fn(({ data }: { data: { tipo: string }[] }) =>
          Promise.resolve(
            data.map((fila, indice) => ({
              id: `doc-${indice}`,
              tipo: fila.tipo,
            })),
          ),
        ),
      },
    };
  }

  function crearRepositorio(tx: ReturnType<typeof crearTx>) {
    const prisma = {
      $transaction: jest.fn((operacion: (cliente: unknown) => unknown) =>
        operacion(tx),
      ),
    } as unknown as PrismaService;
    return new ExpedientesRepository(prisma);
  }

  function datosCaso(
    overrides: Partial<DatosCasoParams> = {},
  ): DatosCasoParams {
    return {
      fecha: '2026-10-02',
      tipoRegistro: 'EXTERNA',
      tipologiaDelito: ['VIOLENCIA_FISICA'],
      fechaIngresoAlbergue: null,
      observaciones: null,
      creadoPorId: 'ts-1',
      agresor: null,
      ninos: [],
      documentosPendientesIds: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: ahora });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sin documentos no consulta la tabla de pendientes', async () => {
    const tx = crearTx([]);

    const resultado = await crearRepositorio(tx).crearParaUsuariaExistente(
      'u-1',
      datosCaso(),
    );

    expect(resultado.documentosAdjuntados).toEqual([]);
    expect(tx.documentoPendiente.findMany).not.toHaveBeenCalled();
  });

  it('solo busca los subidos por quien registra y dentro de las últimas 24 h', async () => {
    const tx = crearTx([pendiente('p-1', 'ENTREVISTA_USUARIA')]);

    await crearRepositorio(tx).crearParaUsuariaExistente(
      'u-1',
      datosCaso({ documentosPendientesIds: ['p-1'] }),
    );

    expect(tx.documentoPendiente.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['p-1'] },
        subidoPorId: 'ts-1',
        createdAt: { gte: new Date('2026-10-01T12:00:00.000Z') },
      },
    });
  });

  it('los convierte en documentos del caso con la misma clave en R2, sin visibilidad, y borra los pendientes', async () => {
    const tx = crearTx([pendiente('p-1', 'ENTREVISTA_USUARIA')]);

    const resultado = await crearRepositorio(tx).crearParaUsuariaExistente(
      'u-1',
      datosCaso({ documentosPendientesIds: ['p-1'] }),
    );

    expect(tx.documento.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        {
          expedienteId: 'exp-1',
          tipo: 'ENTREVISTA_USUARIA',
          nombreArchivo: 'p-1.pdf',
          claveR2: 'registro/p-1',
          mimeType: 'application/pdf',
          tamanioBytes: 1024,
          subidoPorId: 'ts-1',
        },
      ],
      select: { id: true, tipo: true },
    });
    expect(tx.documentoPendiente.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['p-1'] } },
    });
    expect(resultado.documentosAdjuntados).toEqual([
      { id: 'doc-0', tipo: 'ENTREVISTA_USUARIA' },
    ]);
  });

  it('si falta alguno (de otra persona, vencido o ya usado) revierte todo el registro', async () => {
    // Se pidieron dos, pero el filtro por `subidoPorId`/fecha solo devolvió uno.
    const tx = crearTx([pendiente('p-1', 'ENTREVISTA_USUARIA')]);

    await expect(
      crearRepositorio(tx).crearParaUsuariaExistente(
        'u-1',
        datosCaso({ documentosPendientesIds: ['p-1', 'p-de-otra'] }),
      ),
    ).rejects.toBeInstanceOf(DocumentoPendienteNoDisponibleError);
    expect(tx.documento.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('rechaza dos documentos del mismo tipo', async () => {
    const tx = crearTx([
      pendiente('p-1', 'ENTREVISTA_USUARIA'),
      pendiente('p-2', 'ENTREVISTA_USUARIA'),
    ]);

    await expect(
      crearRepositorio(tx).crearParaUsuariaExistente(
        'u-1',
        datosCaso({ documentosPendientesIds: ['p-1', 'p-2'] }),
      ),
    ).rejects.toBeInstanceOf(DocumentoPendienteNoDisponibleError);
  });

  it('rechaza un documento de albergue en un caso Externa', async () => {
    const tx = crearTx([pendiente('p-1', 'CONVENIO_INGRESO')]);

    await expect(
      crearRepositorio(tx).crearParaUsuariaExistente(
        'u-1',
        datosCaso({ documentosPendientesIds: ['p-1'] }),
      ),
    ).rejects.toBeInstanceOf(DocumentoPendienteNoAplicaError);
    expect(tx.documento.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('ignora ids repetidos en la petición', async () => {
    const tx = crearTx([pendiente('p-1', 'ENTREVISTA_USUARIA')]);

    await crearRepositorio(tx).crearParaUsuariaExistente(
      'u-1',
      datosCaso({ documentosPendientesIds: ['p-1', 'p-1'] }),
    );

    expect(tx.documento.createManyAndReturn).toHaveBeenCalledTimes(1);
  });
});
