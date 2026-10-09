/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type {
  DetalleProcesoRepo,
  IConsultasProcesosRepository,
} from '../interfaces/consultas-procesos-repository.interface';
import {
  contexto,
  crearAcceso,
  crearAuditService,
  crearBandejaRepository,
  crearProcesosRepository,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
  USUARIA_ID,
} from '../pruebas/dobles';
import {
  ConsultasProcesosService,
  palabrasDeBusqueda,
} from './consultas-procesos.service';

// Datos ficticios.
function detalle(
  parcial: Partial<DetalleProcesoRepo> = {},
): DetalleProcesoRepo {
  return {
    id: PROCESO_ID,
    codigo: 'P1-05-2026',
    usuariaId: USUARIA_ID,
    usuariaNombreCompleto: 'Usuaria De Prueba',
    expedienteNumero: '05-2026',
    etapa: 'SEGUIMIENTO',
    sesionesAtendidas: 2,
    ultimaSesion: null,
    proximaCita: null,
    fechaInicio: '2026-09-01T15:00:00.000Z',
    fechaCierre: null,
    expedienteId: EXPEDIENTE_ID,
    version: 3,
    psicologa: 'Psicóloga De Prueba',
    soloLectura: false,
    psicologasAnteriores: [],
    motivoReferencia: null,
    motivoCierre: null,
    resumenCierre: null,
    personasAtendidas: [],
    citasSinRegistrar: [],
    visibilidad: { visibleJuridico: false, visibleMedica: false },
    ...parcial,
  };
}

function crearConsultasRepository(): jest.Mocked<IConsultasProcesosRepository> {
  return {
    listar: jest.fn().mockResolvedValue({ items: [], siguienteCursor: null }),
    listarDeUsuaria: jest.fn().mockResolvedValue([]),
    listarDeColegas: jest.fn().mockResolvedValue([]),
    resumen: jest.fn(),
    obtenerDetalle: jest.fn().mockResolvedValue(detalle()),
    listarSesiones: jest
      .fn()
      .mockResolvedValue({ items: [{}, {}], siguienteCursor: null }),
  };
}

describe('palabrasDeBusqueda', () => {
  it.each([
    [undefined, []],
    ['  ana   lópez ', ['ana', 'lópez']],
    ['05-2026', ['05-2026']],
    // Los comodines de LIKE no pueden convertir la búsqueda en "todo".
    ['%%% a_b\\c', ['abc']],
    ['a b c d e f g', ['a', 'b', 'c', 'd', 'e']],
  ])('%p → %p', (q, esperado) => {
    expect(palabrasDeBusqueda(q)).toEqual(esperado);
  });
});

describe('ConsultasProcesosService', () => {
  let consultasRepository: ReturnType<typeof crearConsultasRepository>;
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: ConsultasProcesosService;

  beforeEach(() => {
    consultasRepository = crearConsultasRepository();
    procesosRepository = crearProcesosRepository();
    auditService = crearAuditService();
    service = new ConsultasProcesosService(
      consultasRepository,
      crearAcceso(crearBandejaRepository(), procesosRepository),
      auditService,
    );
  });

  describe('lista y resumen', () => {
    it('lista siempre los procesos de quien consulta, nunca los de otra psicóloga', async () => {
      await service.listar(
        { filtro: 'SIN_PROXIMA', q: 'ana 05-2026', cursor: 'c1' },
        'psicologa-a',
      );

      expect(consultasRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({
          psicologaId: 'psicologa-a',
          filtro: 'SIN_PROXIMA',
          palabras: ['ana', '05-2026'],
          cursor: 'c1',
          limite: 20,
        }),
      );
    });

    it('cuenta el resumen solo para quien consulta', async () => {
      await service.resumen('psicologa-a');

      expect(consultasRepository.resumen).toHaveBeenCalledWith(
        'psicologa-a',
        expect.any(Date),
      );
    });
  });

  describe('detalle', () => {
    it('devuelve el detalle con las acciones que permite la etapa', async () => {
      const resultado = await service.obtener(PROCESO_ID, contexto);

      expect(consultasRepository.obtenerDetalle).toHaveBeenCalledWith(
        PROCESO_ID,
        'psicologa-a',
        expect.any(Date),
      );
      expect(resultado.accionesDisponibles).toEqual([
        'PROGRAMAR_CITA',
        'REGISTRAR_SESION',
        'CERRAR',
        'EDITAR_VISIBILIDAD',
      ]);
    });

    it('en un proceso cerrado solo deja corregir la visibilidad', async () => {
      consultasRepository.obtenerDetalle.mockResolvedValue(
        detalle({ etapa: 'CIERRE' }),
      );

      const resultado = await service.obtener(PROCESO_ID, contexto);

      expect(resultado.accionesDisponibles).toEqual(['EDITAR_VISIBILIDAD']);
    });

    it('el proceso cerrado de una colega se entrega en solo lectura: sin ninguna acción', async () => {
      consultasRepository.obtenerDetalle.mockResolvedValue(
        detalle({ etapa: 'CIERRE', soloLectura: true }),
      );

      const resultado = await service.obtener(PROCESO_ID, contexto);

      expect(resultado.soloLectura).toBe(true);
      expect(resultado.accionesDisponibles).toEqual([]);
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'PROCESO_PSICOLOGICO_CONSULTADO',
          detalles: { expedienteId: EXPEDIENTE_ID, deColega: true },
        }),
      ]);
    });

    it('rechaza con 403 el proceso inexistente o que no puede leer, sin auditar una lectura', async () => {
      consultasRepository.obtenerDetalle.mockResolvedValue(null);

      await expect(
        service.obtener(PROCESO_ID, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('audita la consulta solo con ids', async () => {
      await service.obtener(PROCESO_ID, contexto);

      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'PROCESO_PSICOLOGICO_CONSULTADO',
          entidadId: PROCESO_ID,
          detalles: { expedienteId: EXPEDIENTE_ID, deColega: false },
        }),
      ]);
    });
  });

  describe('sesiones (notas clínicas)', () => {
    it('rechaza con 403 a quien no puede leer el proceso, sin leer ni una nota', async () => {
      procesosRepository.buscarLecturaProceso.mockResolvedValue(null);

      await expect(
        service.sesiones(PROCESO_ID, {}, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.buscarLecturaProceso).toHaveBeenCalledWith(
        PROCESO_ID,
        'psicologa-a',
      );
      expect(consultasRepository.listarSesiones).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('entrega la página a la dueña y deja constancia de la lectura', async () => {
      const pagina = await service.sesiones(
        PROCESO_ID,
        { cursor: 'c1' },
        contexto,
      );

      expect(pagina.items).toHaveLength(2);
      expect(consultasRepository.listarSesiones).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        cursor: 'c1',
        limite: 20,
      });
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'SESIONES_PROCESO_PSICOLOGICO_CONSULTADAS',
          entidadId: PROCESO_ID,
          detalles: {
            expedienteId: EXPEDIENTE_ID,
            deColega: false,
            resultados: 2,
          },
        }),
      ]);
    });

    it('entrega las notas del proceso cerrado de una colega y lo deja anotado en la auditoría', async () => {
      procesosRepository.buscarLecturaProceso.mockResolvedValue({
        id: PROCESO_ID,
        expedienteId: EXPEDIENTE_ID,
        propio: false,
      });
      // No es la dueña: el acceso de escritura seguiría respondiendo que no.
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

      const pagina = await service.sesiones(PROCESO_ID, {}, contexto);

      expect(pagina.items).toHaveLength(2);
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'SESIONES_PROCESO_PSICOLOGICO_CONSULTADAS',
          detalles: {
            expedienteId: EXPEDIENTE_ID,
            deColega: true,
            resultados: 2,
          },
        }),
      ]);
    });
  });
});
