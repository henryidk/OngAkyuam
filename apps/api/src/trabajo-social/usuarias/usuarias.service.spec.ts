/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsuariasService } from './usuarias.service';
import type {
  CasoHubRow,
  IUsuariasRepository,
  UsuariaHubRow,
} from './interfaces/usuarias-repository.interface';
import type { IAreaNotifier } from '../../areas/interfaces/area-notifier.interface';
import type { AuditService } from '../../auth/services/audit.service';
import type { EstadoTsService } from '../estado/estado-ts.service';
import { DpiUsuariaDuplicadoError } from '../interfaces/expedientes-repository.interface';
import type {
  EditarIdentidadUsuariaInput,
  ListaUsuariasTs,
} from '@akyuam/shared';

describe('UsuariasService', () => {
  let service: UsuariasService;
  let usuariasRepository: jest.Mocked<IUsuariasRepository>;
  let auditService: jest.Mocked<AuditService>;
  let estadoTsService: jest.Mocked<EstadoTsService>;
  let areaNotifier: jest.Mocked<IAreaNotifier>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function hub(overrides: Partial<UsuariaHubRow> = {}): UsuariaHubRow {
    return {
      id: 'u-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      nombres: 'Maria',
      apellidos: 'Perez',
      dpi: '1234567890123',
      telefono: '12345678',
      direccion: 'Zona 1',
      fechaNacimiento: '1990-01-01',
      grupoEtnico: 'LADINO',
      municipio: 'COBAN',
      departamentoOtro: null,
      municipioOtro: null,
      ubicacionGeografica: 'Zona 1',
      casos: [],
      ...overrides,
    };
  }

  function identidadInput(
    overrides: Partial<EditarIdentidadUsuariaInput> = {},
  ): EditarIdentidadUsuariaInput {
    return {
      nombres: 'Maria',
      apellidos: 'Perez',
      dpi: '1234567890123',
      telefono: '12345678',
      direccion: 'Zona 1',
      fechaNacimiento: '1990-01-01',
      grupoEtnico: 'LADINO',
      fueraDeAltaVerapaz: false,
      municipio: 'COBAN',
      departamentoOtro: '',
      municipioOtro: '',
      ubicacionGeografica: 'Zona 1',
      ...overrides,
    };
  }

  function caso(overrides: Partial<CasoHubRow> = {}): CasoHubRow {
    return {
      id: 'e-1',
      numero: '01-2026',
      fecha: '2026-01-01',
      tipoRegistro: 'EXTERNA',
      enAlbergue: false,
      referidos: [],
      ...overrides,
    };
  }

  const listaVacia: ListaUsuariasTs = {
    filas: [],
    pagina: 1,
    porPagina: 20,
    total: 0,
    contadores: {
      TODAS: 0,
      SIN_REFERIR: 0,
      EN_ATENCION: 0,
      EN_ALBERGUE: 0,
      SIN_ATENCION_ACTIVA: 0,
    },
  };

  beforeEach(() => {
    usuariasRepository = {
      listar: jest.fn().mockResolvedValue(listaVacia),
      buscarPorDpi: jest.fn(),
      buscarPorNombre: jest.fn(),
      buscarPorNumero: jest.fn(),
      obtenerHub: jest.fn(),
      existeDpi: jest.fn().mockResolvedValue(false),
      actualizarIdentidad: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    estadoTsService = {
      resolverCaso: jest
        .fn()
        .mockResolvedValue({ estado: 'SIN_REFERIR', areas: [] }),
    } as unknown as jest.Mocked<EstadoTsService>;

    areaNotifier = {
      notificarReferido: jest.fn(),
      notificarUsuariaActualizada: jest.fn(),
    };

    service = new UsuariasService(
      usuariasRepository,
      auditService,
      estadoTsService,
      areaNotifier,
    );
  });

  describe('listar', () => {
    it.each([
      ['5-2026', { tipo: 'numeroExpediente', valor: '05-2026' }],
      ['12-2026', { tipo: 'numeroExpediente', valor: '12-2026' }],
      ['0000000000000', { tipo: 'dpi', valor: '0000000000000' }],
      ['Ana', { tipo: 'nombre', valor: 'Ana' }],
    ])('interpreta "%s" como la búsqueda correcta', async (q, busqueda) => {
      await service.listar({ q, pagina: 1 }, contexto);

      expect(usuariasRepository.listar).toHaveBeenCalledWith({
        filtro: undefined,
        busqueda,
        pagina: 1,
        porPagina: 20,
      });
    });

    it('rechaza un nombre de menos de 3 letras sin consultar', async () => {
      await expect(
        service.listar({ q: 'An', pagina: 1 }, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariasRepository.listar).not.toHaveBeenCalled();
    });

    it('audita el tipo de búsqueda y el filtro, nunca el término escrito', async () => {
      await service.listar(
        { q: '0000000000000', estado: 'EN_ALBERGUE', pagina: 2 },
        contexto,
      );

      const detalles = auditService.registrar.mock.calls[0][0].detalles;
      expect(JSON.stringify(detalles)).not.toContain('0000000000000');
      expect(detalles).toEqual({
        filtro: 'EN_ALBERGUE',
        busqueda: 'dpi',
        pagina: 2,
        resultados: 0,
      });
    });
  });

  describe('buscar', () => {
    it('rechaza buscar sin dpi ni nombre', async () => {
      await expect(service.buscar({}, contexto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usuariasRepository.buscarPorNombre).not.toHaveBeenCalled();
    });

    it('rechaza buscar por nombre con menos de 3 caracteres', async () => {
      await expect(
        service.buscar({ nombre: 'ab' }, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariasRepository.buscarPorNombre).not.toHaveBeenCalled();
    });

    it('busca por DPI exacto y audita solo el conteo de resultados, nunca el DPI', async () => {
      usuariasRepository.buscarPorDpi.mockResolvedValue({
        id: 'u-1',
        nombres: 'Maria',
        apellidos: 'Perez',
        dpi: '1234567890123',
        fechaNacimiento: '1990-01-01',
        numeroExpediente: '05-2026',
      });

      const resultado = await service.buscar(
        { dpi: '1234567890123' },
        contexto,
      );

      expect(resultado).toHaveLength(1);
      const detalles = auditService.registrar.mock.calls[0][0].detalles;
      expect(JSON.stringify(detalles)).not.toContain('1234567890123');
      expect(detalles).toEqual({ resultados: 1 });
    });

    it('busca por nombre difuso cuando no viene dpi', async () => {
      usuariasRepository.buscarPorNombre.mockResolvedValue([]);

      await service.buscar({ nombre: 'Maria Perez' }, contexto);

      expect(usuariasRepository.buscarPorNombre).toHaveBeenCalledWith(
        'Maria Perez',
        20,
      );
    });

    describe('con `q` (buscador global)', () => {
      it('interpreta un número de expediente y lo busca por número', async () => {
        usuariasRepository.buscarPorNumero.mockResolvedValue([]);

        await service.buscar({ q: '5-2026' }, contexto);

        expect(usuariasRepository.buscarPorNumero).toHaveBeenCalledWith(
          '05-2026',
          20,
        );
      });

      it('interpreta un DPI de 13 dígitos y lo busca exacto', async () => {
        usuariasRepository.buscarPorDpi.mockResolvedValue(null);

        await service.buscar({ q: '1234567890123' }, contexto);

        expect(usuariasRepository.buscarPorDpi).toHaveBeenCalledWith(
          '1234567890123',
        );
      });

      it('interpreta cualquier otro término como nombre', async () => {
        usuariasRepository.buscarPorNombre.mockResolvedValue([]);

        await service.buscar({ q: 'Maria' }, contexto);

        expect(usuariasRepository.buscarPorNombre).toHaveBeenCalledWith(
          'Maria',
          20,
        );
      });

      it('rechaza un `q` de menos de 3 letras que no sea número ni DPI', async () => {
        await expect(
          service.buscar({ q: 'an' }, contexto),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(usuariasRepository.buscarPorNombre).not.toHaveBeenCalled();
      });

      it('`q` manda sobre `dpi`/`nombre` si vinieran los tres', async () => {
        usuariasRepository.buscarPorNombre.mockResolvedValue([]);

        await service.buscar(
          { q: 'Maria', dpi: '1234567890123', nombre: 'Otro' },
          contexto,
        );

        expect(usuariasRepository.buscarPorNombre).toHaveBeenCalledWith(
          'Maria',
          20,
        );
        expect(usuariasRepository.buscarPorDpi).not.toHaveBeenCalled();
      });
    });
  });

  describe('obtenerHub', () => {
    it('lanza 404 si la usuaria no existe', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(null);

      await expect(service.obtenerHub('u-x', contexto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('devuelve el hub y audita la consulta', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(hub());

      const resultado = await service.obtenerHub('u-1', contexto);

      expect(resultado.id).toBe('u-1');
      expect(resultado.casoActivo).toBeNull();
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'EXPEDIENTE_CONSULTADO',
          entidad: 'Usuaria',
        }),
      );
    });

    it('agrega el estado de cada caso y el detalle por área del caso activo', async () => {
      const referidoEn = new Date('2026-02-01T15:00:00.000Z');
      usuariasRepository.obtenerHub.mockResolvedValue(
        hub({
          casos: [
            caso({
              id: 'e-2',
              referidos: [
                {
                  area: 'JURIDICO',
                  prioridad: 'NORMAL',
                  profesional: null,
                  createdAt: referidoEn,
                },
              ],
            }),
            caso({ id: 'e-1' }),
          ],
        }),
      );
      const areaJuridico = {
        area: 'JURIDICO' as const,
        estado: 'ACTIVA' as const,
        detalle: 'Sin procesos abiertos todavía',
        profesional: null,
        prioridad: 'NORMAL' as const,
        referidoEn: referidoEn.toISOString(),
      };
      estadoTsService.resolverCaso
        .mockResolvedValueOnce({ estado: 'EN_ATENCION', areas: [areaJuridico] })
        .mockResolvedValueOnce({ estado: 'SIN_REFERIR', areas: [] });

      const resultado = await service.obtenerHub('u-1', contexto);

      expect(estadoTsService.resolverCaso).toHaveBeenCalledWith([
        {
          area: 'JURIDICO',
          prioridad: 'NORMAL',
          profesional: null,
          createdAt: referidoEn,
          expedienteId: 'e-2',
        },
      ]);
      expect(resultado.casos.map((c) => [c.id, c.estado])).toEqual([
        ['e-2', 'EN_ATENCION'],
        ['e-1', 'SIN_REFERIR'],
      ]);
      expect(resultado.casos[0].areasReferidas).toEqual(['JURIDICO']);
      expect(resultado.casoActivo).toEqual({
        id: 'e-2',
        estado: 'EN_ATENCION',
        areas: [areaJuridico],
      });
    });
  });

  describe('actualizarIdentidad', () => {
    it('lanza 404 si la usuaria no existe', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(null);

      await expect(
        service.actualizarIdentidad('u-x', identidadInput(), contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(usuariasRepository.actualizarIdentidad).not.toHaveBeenCalled();
    });

    it('rechaza DPI ya usado por otra usuaria', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(hub());
      usuariasRepository.existeDpi.mockResolvedValue(true);

      await expect(
        service.actualizarIdentidad(
          'u-1',
          identidadInput({ dpi: '9999999999999' }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usuariasRepository.actualizarIdentidad).not.toHaveBeenCalled();
    });

    it('actualiza y audita solo los nombres de los campos que cambiaron, nunca sus valores', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(
        hub({ telefono: '00000000' }),
      );
      usuariasRepository.actualizarIdentidad.mockResolvedValue(
        hub({ telefono: '12345678' }),
      );

      await service.actualizarIdentidad(
        'u-1',
        identidadInput({ telefono: '12345678' }),
        contexto,
      );

      const detalles = auditService.registrar.mock.calls[0][0].detalles as {
        campos: string[];
      };
      expect(detalles.campos).toEqual(['telefono']);
      expect(auditService.registrar.mock.calls[0][0].accion).toBe(
        'USUARIA_ACTUALIZADA',
      );
    });

    it('la auditoría no contiene ningún valor, ni el DPI ni el teléfono', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(
        hub({ dpi: '1111111111111', telefono: '00000000' }),
      );
      usuariasRepository.actualizarIdentidad.mockResolvedValue(
        hub({ dpi: '2222222222222', telefono: '55554444' }),
      );

      await service.actualizarIdentidad(
        'u-1',
        identidadInput({ dpi: '2222222222222', telefono: '55554444' }),
        contexto,
      );

      const auditoria = auditService.registrar.mock.calls[0][0];
      expect(auditoria.accion).toBe('USUARIA_DPI_MODIFICADO');
      expect(auditoria.detalles).toEqual({ campos: ['dpi', 'telefono'] });
      const serializado = JSON.stringify(auditoria.detalles);
      for (const valor of [
        '1111111111111',
        '2222222222222',
        '00000000',
        '55554444',
      ]) {
        expect(serializado).not.toContain(valor);
      }
    });

    it('responde 409 si el índice único rechaza el DPI al guardar', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(hub());
      usuariasRepository.actualizarIdentidad.mockRejectedValue(
        new DpiUsuariaDuplicadoError(),
      );

      await expect(
        service.actualizarIdentidad(
          'u-1',
          identidadInput({ dpi: '9999999999999' }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('avisa a cada área referida solo con el id del expediente', async () => {
      const casos = [
        caso({
          id: 'e-1',
          referidos: [
            { area: 'JURIDICO' },
            { area: 'PSICOLOGIA' },
          ] as CasoHubRow['referidos'],
        }),
      ];
      usuariasRepository.obtenerHub.mockResolvedValue(
        hub({ telefono: '00000000', casos }),
      );
      usuariasRepository.actualizarIdentidad.mockResolvedValue(hub({ casos }));

      await service.actualizarIdentidad('u-1', identidadInput(), contexto);

      expect(areaNotifier.notificarUsuariaActualizada.mock.calls).toEqual([
        ['JURIDICO', 'e-1'],
        ['PSICOLOGIA', 'e-1'],
      ]);
    });

    it('no avisa a las áreas si nada cambió', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(hub());
      usuariasRepository.actualizarIdentidad.mockResolvedValue(hub());

      await service.actualizarIdentidad('u-1', identidadInput(), contexto);

      expect(areaNotifier.notificarUsuariaActualizada).not.toHaveBeenCalled();
    });
  });
});
