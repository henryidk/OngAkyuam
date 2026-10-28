/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { DetalleConsultaPsicologiaDto } from '@akyuam/shared';
import type { IConsultasSesionesRepository } from '../interfaces/consultas-sesiones-repository.interface';
import {
  CITA_ID,
  contexto,
  crearAcceso,
  crearAuditService,
  crearBandejaRepository,
  crearCitasRepository,
  crearProcesosRepository,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
} from '../pruebas/dobles';
import { ConsultasPsicologiaService } from './consultas-psicologia.service';

// Datos ficticios.
const SESION = {
  citaId: CITA_ID,
  procesoId: PROCESO_ID,
  procesoCodigo: '05-2026',
  usuariaId: 'usuaria-1',
  usuariaNombreCompleto: 'Usuaria De Prueba',
  atendidoPor: 'Psicóloga B',
  numero: 2,
  fechaHora: '2026-10-01T15:00:00.000Z',
  duracionMinutos: 45,
  estado: 'ATENDIDA',
  persona: { ninoId: null, nombreCompleto: 'Usuaria De Prueba', edad: 30 },
  temas: 'Nota clínica de prueba',
  intervencion: null,
  recomendaciones: null,
  acuerdos: null,
  observaciones: null,
  motivoNoAsistencia: null,
  clinica: 'CLINICA_1',
  enfoqueTerapeutico: null,
  documento: null,
} satisfies DetalleConsultaPsicologiaDto;

function crearSesionesRepository(): jest.Mocked<IConsultasSesionesRepository> {
  return {
    porRegistrar: jest.fn().mockResolvedValue([]),
    historial: jest
      .fn()
      .mockResolvedValue({ items: [{}, {}, {}], siguienteCursor: null }),
    detalle: jest.fn().mockResolvedValue(SESION),
  };
}

const BUSQUEDA = {
  desde: '2026-10-01',
  hasta: '2026-10-31',
  de: 'EQUIPO',
} as const;

describe('ConsultasPsicologiaService', () => {
  let sesionesRepository: ReturnType<typeof crearSesionesRepository>;
  let citasRepository: ReturnType<typeof crearCitasRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: ConsultasPsicologiaService;

  beforeEach(() => {
    sesionesRepository = crearSesionesRepository();
    citasRepository = crearCitasRepository();
    auditService = crearAuditService();
    service = new ConsultasPsicologiaService(
      sesionesRepository,
      crearAcceso(
        crearBandejaRepository(),
        crearProcesosRepository(),
        citasRepository,
      ),
      auditService,
    );
  });

  describe('por registrar', () => {
    it('pide solo las sesiones de quien consulta', async () => {
      await service.porRegistrar('psicologa-a');

      expect(sesionesRepository.porRegistrar).toHaveBeenCalledWith(
        'psicologa-a',
        expect.any(Date),
      );
    });
  });

  describe('historial', () => {
    it('busca con el id de la sesión y el rango completo de días de Guatemala', async () => {
      await service.historial(
        { ...BUSQUEDA, q: 'ana  05-2026', clinica: 'CLINICA_2' },
        contexto,
      );

      expect(sesionesRepository.historial).toHaveBeenCalledWith(
        expect.objectContaining({
          psicologaId: 'psicologa-a',
          alcance: 'EQUIPO',
          // 00:00 de Guatemala (UTC-6) del primer día y del día siguiente al último.
          desde: new Date('2026-10-01T06:00:00.000Z'),
          hasta: new Date('2026-11-01T06:00:00.000Z'),
          palabras: ['ana', '05-2026'],
          clinica: 'CLINICA_2',
          limite: 25,
        }),
      );
    });

    it('audita la búsqueda sin guardar el texto buscado', async () => {
      await service.historial(
        { ...BUSQUEDA, q: 'Nombre Buscado', estado: 'NO_ASISTIO' },
        contexto,
      );

      const [evento] = eventosAuditados(auditService);
      expect(evento).toMatchObject({
        accion: 'HISTORIAL_SESIONES_PSICOLOGIA_CONSULTADO',
        detalles: {
          desde: '2026-10-01',
          hasta: '2026-10-31',
          de: 'EQUIPO',
          estado: 'NO_ASISTIO',
          conBusqueda: true,
          pagina: 'primera',
          resultados: 3,
        },
      });
      expect(JSON.stringify(evento)).not.toContain('Nombre');
    });

    it('si la auditoría falla, no devuelve las filas', async () => {
      auditService.registrar.mockRejectedValue(new Error('sin base'));

      await expect(service.historial(BUSQUEDA, contexto)).rejects.toThrow(
        'sin base',
      );
    });
  });

  describe('detalle', () => {
    it('sin lectura sobre la cita: 403 sin tocar el repositorio ni la auditoría', async () => {
      (citasRepository.buscarLecturaCita as jest.Mock).mockResolvedValue(null);

      await expect(service.detalle(CITA_ID, contexto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(sesionesRepository.detalle).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('una cita aún sin registrar responde el mismo 403', async () => {
      sesionesRepository.detalle.mockResolvedValue(null);

      await expect(service.detalle(CITA_ID, contexto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('audita cada apertura con ids y sin texto clínico', async () => {
      (citasRepository.buscarLecturaCita as jest.Mock).mockResolvedValue({
        id: CITA_ID,
        atencionId: PROCESO_ID,
        expedienteId: EXPEDIENTE_ID,
        propia: false,
      });

      await expect(service.detalle(CITA_ID, contexto)).resolves.toEqual(SESION);

      const [evento] = eventosAuditados(auditService);
      expect(evento).toEqual(
        expect.objectContaining({
          accion: 'SESION_PSICOLOGICA_VISTA',
          entidadId: CITA_ID,
          detalles: {
            expedienteId: EXPEDIENTE_ID,
            procesoId: PROCESO_ID,
            deColega: true,
          },
        }),
      );
      expect(JSON.stringify(evento)).not.toContain('Nota clínica');
    });
  });
});
