/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ProcesoPsicologiaResumen } from '@akyuam/shared';
import type { IConsultasProcesosRepository } from '../interfaces/consultas-procesos-repository.interface';
import type {
  FichaUsuariaRepo,
  IUsuariasPsicologiaRepository,
} from '../interfaces/usuarias-psicologia-repository.interface';
import {
  contexto,
  crearAuditService,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
  USUARIA_ID,
} from '../pruebas/dobles';
import { UsuariasPsicologiaService } from './usuarias-psicologia.service';

// Datos ficticios.
const FICHA: FichaUsuariaRepo = {
  usuaria: {
    id: USUARIA_ID,
    nombreCompleto: 'Usuaria De Prueba',
    dpi: null,
    edad: 30,
    grupoEtnico: 'MAYA',
    municipio: 'Cobán',
  },
  expediente: {
    id: EXPEDIENTE_ID,
    numero: '05-2026',
    tipoRegistro: 'EXTERNA',
    enAlbergue: false,
  },
  referencias: [],
  puedeAbrirProceso: false,
};

function proceso(
  etapa: ProcesoPsicologiaResumen['etapa'],
): ProcesoPsicologiaResumen {
  return {
    id: PROCESO_ID,
    codigo: 'P1-05-2026',
    usuariaId: USUARIA_ID,
    usuariaNombreCompleto: 'Usuaria De Prueba',
    expedienteNumero: '05-2026',
    etapa,
    sesionesAtendidas: 0,
    ultimaSesion: null,
    proximaCita: null,
    fechaInicio: '2026-09-01T15:00:00.000Z',
    fechaCierre: null,
  };
}

const LISTA_VACIA = {
  filas: [],
  pagina: 1,
  porPagina: 20,
  total: 0,
  contadores: { TODAS: 0, REFERENCIA_NUEVA: 0, CON_ACTIVO: 0, SIN_ACTIVO: 0 },
};

describe('UsuariasPsicologiaService', () => {
  let usuariasRepository: jest.Mocked<IUsuariasPsicologiaRepository>;
  let consultasRepository: jest.Mocked<
    Pick<IConsultasProcesosRepository, 'listarDeUsuaria'>
  >;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: UsuariasPsicologiaService;

  beforeEach(() => {
    usuariasRepository = {
      listar: jest.fn().mockResolvedValue(LISTA_VACIA),
      obtenerFicha: jest.fn().mockResolvedValue(FICHA),
    };
    consultasRepository = {
      listarDeUsuaria: jest
        .fn()
        .mockResolvedValue([
          proceso('SEGUIMIENTO'),
          proceso('CIERRE'),
          proceso('CIERRE'),
        ]),
    };
    auditService = crearAuditService();
    service = new UsuariasPsicologiaService(
      usuariasRepository,
      consultasRepository as unknown as IConsultasProcesosRepository,
      auditService,
    );
  });

  describe('lista', () => {
    it('lista solo lo que puede ver quien consulta', async () => {
      await service.listar(
        { filtro: 'CON_ACTIVO', q: '5-2026', pagina: 2 },
        contexto,
      );

      expect(usuariasRepository.listar).toHaveBeenCalledWith({
        psicologaId: 'psicologa-a',
        filtro: 'CON_ACTIVO',
        busqueda: { tipo: 'numeroExpediente', valor: '05-2026' },
        pagina: 2,
        porPagina: 20,
      });
    });

    it('audita que se listó, nunca el texto buscado', async () => {
      await service.listar({ q: 'Nombre Buscado', pagina: 1 }, contexto);

      const [evento] = eventosAuditados(auditService);
      expect(evento).toMatchObject({
        accion: 'USUARIAS_PSICOLOGIA_LISTADAS',
        detalles: {
          filtro: null,
          conBusqueda: true,
          pagina: 1,
          resultados: 0,
        },
      });
      expect(JSON.stringify(evento)).not.toContain('Nombre Buscado');
    });

    it('rechaza con 400 una búsqueda por nombre demasiado corta', async () => {
      await expect(
        service.listar({ q: 'ab', pagina: 1 }, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariasRepository.listar).not.toHaveBeenCalled();
    });
  });

  describe('ficha', () => {
    it('rechaza con 403 a la usuaria inexistente o que solo atiende otra psicóloga', async () => {
      usuariasRepository.obtenerFicha.mockResolvedValue(null);

      await expect(
        service.obtener(USUARIA_ID, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(usuariasRepository.obtenerFicha).toHaveBeenCalledWith(
        USUARIA_ID,
        'psicologa-a',
      );
      expect(consultasRepository.listarDeUsuaria).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('arma la ficha solo con los procesos de quien consulta y sus contadores', async () => {
      const ficha = await service.obtener(USUARIA_ID, contexto);

      expect(consultasRepository.listarDeUsuaria).toHaveBeenCalledWith(
        USUARIA_ID,
        'psicologa-a',
        expect.any(Date),
      );
      expect(ficha.procesos).toHaveLength(3);
      expect(ficha.contadores).toEqual({ enProceso: 1, cerrados: 2 });
    });

    it('audita la consulta solo con ids', async () => {
      await service.obtener(USUARIA_ID, contexto);

      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'FICHA_USUARIA_PSICOLOGIA_CONSULTADA',
          entidadId: USUARIA_ID,
          detalles: { expedienteId: EXPEDIENTE_ID },
        }),
      ]);
    });
  });
});
