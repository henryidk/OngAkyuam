/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ReferirInput } from '@akyuam/shared';
import type { IAreaNotifier } from '../../areas/interfaces/area-notifier.interface';
import { PoliticasAcceso } from '../../areas/politicas/politicas-acceso';
import type { AuditService } from '../../auth/services/audit.service';
import {
  AreaYaReferidaError,
  type CrearReferidoParams,
  type ExpedienteParaReferir,
  type IReferidosRepository,
} from './interfaces/referidos-repository.interface';
import { ReferidosService } from './referidos.service';

const EXPEDIENTE_ID = '11111111-1111-4111-8111-111111111111';
const PSICOLOGA_ID = '22222222-2222-4222-8222-222222222222';

const contexto = {
  usuarioId: 'ts-1',
  username: 'trabajo.social',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

function expediente(
  areasReferidas: ExpedienteParaReferir['areasReferidas'] = [],
): ExpedienteParaReferir {
  return {
    id: EXPEDIENTE_ID,
    numero: '01-2026',
    fecha: '2026-01-15',
    municipio: null,
    tipoRegistro: 'EXTERNA',
    usuariaNombreCompleto: 'Nombre Ficticio',
    areasReferidas,
  };
}

function datos(parcial: Partial<ReferirInput> = {}): ReferirInput {
  return {
    area: 'PSICOLOGIA',
    prioridad: 'NORMAL',
    motivo: '',
    visibilidad: { datosCaso: false, documentos: ['ACCIONES_REALIZADAS'] },
    ...parcial,
  };
}

describe('ReferidosService', () => {
  let service: ReferidosService;
  let repositorio: jest.Mocked<IReferidosRepository>;
  let notifier: jest.Mocked<IAreaNotifier>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    repositorio = {
      buscarExpediente: jest.fn().mockResolvedValue(expediente()),
      esProfesionalActivoDelArea: jest.fn().mockResolvedValue(true),
      listarProfesionales: jest.fn(),
      crear: jest.fn().mockImplementation((params: CrearReferidoParams) =>
        Promise.resolve({
          id: 'referido-1',
          area: params.area,
          prioridad: params.prioridad,
          profesionalAsignadoId: params.profesionalAsignadoId,
          createdAt: new Date('2026-01-15T12:00:00Z'),
        }),
      ),
    };
    notifier = { notificarReferido: jest.fn() };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    service = new ReferidosService(
      repositorio,
      notifier,
      new PoliticasAcceso(),
      auditService,
    );
  });

  it('404 si el expediente no existe', async () => {
    repositorio.buscarExpediente.mockResolvedValue(null);
    await expect(
      service.referir(EXPEDIENTE_ID, datos(), contexto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorio.crear).not.toHaveBeenCalled();
  });

  it('409 si el área ya estaba referida', async () => {
    repositorio.buscarExpediente.mockResolvedValue(expediente(['PSICOLOGIA']));
    await expect(
      service.referir(EXPEDIENTE_ID, datos(), contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repositorio.crear).not.toHaveBeenCalled();
  });

  it('409 si otra persona refirió la misma área al mismo tiempo (restricción única)', async () => {
    repositorio.crear.mockRejectedValue(new AreaYaReferidaError());
    await expect(
      service.referir(EXPEDIENTE_ID, datos(), contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.registrar).not.toHaveBeenCalled();
    expect(notifier.notificarReferido).not.toHaveBeenCalled();
  });

  it('400 si la profesional no es de esa área o no está activa', async () => {
    repositorio.esProfesionalActivoDelArea.mockResolvedValue(false);
    await expect(
      service.referir(
        EXPEDIENTE_ID,
        datos({ profesionalAsignadoId: PSICOLOGA_ID }),
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repositorio.esProfesionalActivoDelArea).toHaveBeenCalledWith(
      PSICOLOGA_ID,
      'PSICOLOGIA',
    );
    expect(repositorio.crear).not.toHaveBeenCalled();
  });

  it('Psicología con profesional: crea la atención ya tomada', async () => {
    await service.referir(
      EXPEDIENTE_ID,
      datos({ profesionalAsignadoId: PSICOLOGA_ID }),
      contexto,
    );
    expect(repositorio.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        profesionalAsignadoId: PSICOLOGA_ID,
        crearAtencionPsicologica: true,
        puedeVerDatosCaso: false,
        documentosVisibles: ['ACCIONES_REALIZADAS'],
        motivo: null,
        otorgadoPorId: 'ts-1',
      }),
    );
  });

  it('Psicología sin profesional: no crea atención (queda en "Referencias sin tomar")', async () => {
    await service.referir(EXPEDIENTE_ID, datos(), contexto);
    expect(repositorio.esProfesionalActivoDelArea).not.toHaveBeenCalled();
    expect(repositorio.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        profesionalAsignadoId: null,
        crearAtencionPsicologica: false,
      }),
    );
  });

  it('Jurídico: ignora la visibilidad pedida (acceso completo, no restringible)', async () => {
    await service.referir(EXPEDIENTE_ID, datos({ area: 'JURIDICO' }), contexto);
    expect(repositorio.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'JURIDICO',
        puedeVerDatosCaso: true,
        documentosVisibles: [],
        crearAtencionPsicologica: false,
      }),
    );
  });

  it('audita sin el motivo y notifica al área con la prioridad', async () => {
    await service.referir(
      EXPEDIENTE_ID,
      datos({ area: 'MEDICA', prioridad: 'URGENTE', motivo: 'Texto libre' }),
      contexto,
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'EXPEDIENTE_REFERIDO',
        entidadId: EXPEDIENTE_ID,
        detalles: { area: 'MEDICA', prioridad: 'URGENTE' },
      }),
    );
    expect(notifier.notificarReferido).toHaveBeenCalledWith(
      'MEDICA',
      expect.objectContaining({ id: EXPEDIENTE_ID, prioridad: 'URGENTE' }),
    );
  });
});
