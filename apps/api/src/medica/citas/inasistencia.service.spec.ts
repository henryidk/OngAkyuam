/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import type { AccesoCitaMedica } from '../interfaces/acceso-medica-repository.interface';
import type { ICitasMedicasRepository } from '../interfaces/citas-medicas-repository.interface';
import {
  CitaNoDisponibleError,
  VersionCambioError,
} from '../interfaces/errores-medica';
import { InasistenciaService } from './inasistencia.service';

const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
// Miércoles 14/10/2026, 09:00 en Guatemala.
const AHORA = new Date('2026-10-14T15:00:00.000Z');
// La cita de las 08:00 de hoy ya terminó y sigue sin registrar.
const CITA: AccesoCitaMedica = {
  citaId: 'c-1',
  atencionId: 'a-1',
  expedienteId: 'exp-1',
  expedienteNumero: '2026-0001',
  usuariaId: 'u-1',
  consecutivo: 2,
  estado: 'ACTIVA',
  version: 1,
  ninoId: null,
  inicio: new Date('2026-10-14T14:00:00.000Z'),
  duracionMin: 30,
  estadoCita: 'PROGRAMADA',
  versionCita: 4,
  consultaId: null,
  reprogramadaAId: null,
};

describe('InasistenciaService', () => {
  let repository: jest.Mocked<ICitasMedicasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let audit: jest.Mocked<AuditService>;
  let service: InasistenciaService;

  beforeEach(() => {
    repository = {
      registrarInasistencia: jest.fn().mockResolvedValue(null),
      reprogramar: jest.fn().mockResolvedValue('c-nueva'),
    } as unknown as jest.Mocked<ICitasMedicasRepository>;
    acceso = {
      exigirCita: jest.fn().mockResolvedValue(CITA),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    audit = { registrar: jest.fn() } as unknown as jest.Mocked<AuditService>;
    service = new InasistenciaService(
      repository,
      { ahora: () => AHORA },
      acceso,
      audit,
    );
  });

  describe('registrar', () => {
    it('sin reprogramar marca la inasistencia y no crea cita', async () => {
      await expect(
        service.registrar('c-1', { version: 4 } as never, CONTEXTO),
      ).resolves.toEqual({ citaId: 'c-1', nuevaCita: null });
      expect(repository.registrarInasistencia).toHaveBeenCalledWith({
        citaId: 'c-1',
        version: 4,
        ahora: AHORA,
        reprogramarA: null,
        creadoPorId: 'medica-1',
      });
      const acciones = audit.registrar.mock.calls.map(([e]) => e.accion);
      expect(acciones).toEqual(['CITA_MEDICA_NO_ASISTIO']);
    });

    it('con reprogramación crea la cita nueva en el mismo paso', async () => {
      repository.registrarInasistencia.mockResolvedValue('c-nueva');
      const respuesta = await service.registrar(
        'c-1',
        { version: 4, reprogramarA: '2026-10-16T10:30' },
        CONTEXTO,
      );
      expect(respuesta.nuevaCita).toEqual({
        citaId: 'c-nueva',
        atencionId: 'a-1',
        codigoAtencion: '2026-0001 · Atención 2',
        atencionAbierta: false,
        fecha: '2026-10-16',
        hora: '10:30',
      });
      const acciones = audit.registrar.mock.calls.map(([e]) => e.accion);
      expect(acciones).toEqual([
        'CITA_MEDICA_NO_ASISTIO',
        'CITA_MEDICA_REPROGRAMADA',
      ]);
    });

    it('una cita que todavía no empieza responde 409', async () => {
      acceso.exigirCita.mockResolvedValue({
        ...CITA,
        inicio: new Date('2026-10-14T16:00:00.000Z'),
      });
      await expect(
        service.registrar('c-1', { version: 4 } as never, CONTEXTO),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.registrarInasistencia).not.toHaveBeenCalled();
    });

    it('una cita ya atendida responde 409', async () => {
      acceso.exigirCita.mockResolvedValue({ ...CITA, estadoCita: 'ATENDIDA' });
      await expect(
        service.registrar('c-1', { version: 4 } as never, CONTEXTO),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.registrarInasistencia).not.toHaveBeenCalled();
    });

    it('reprogramar a un horario inválido responde 400 sin tocar la cita', async () => {
      await expect(
        service.registrar(
          'c-1',
          { version: 4, reprogramarA: '2026-10-18T09:00' },
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.registrarInasistencia).not.toHaveBeenCalled();
    });

    it('una versión vieja responde 409 y no audita', async () => {
      repository.registrarInasistencia.mockRejectedValue(
        new VersionCambioError(),
      );
      await expect(
        service.registrar('c-1', { version: 3 } as never, CONTEXTO),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(audit.registrar).not.toHaveBeenCalled();
    });
  });

  describe('reprogramar', () => {
    it('crea la cita nueva y audita la reprogramación', async () => {
      acceso.exigirCita.mockResolvedValue({
        ...CITA,
        estadoCita: 'NO_ASISTIO',
      });
      await expect(
        service.reprogramar(
          'c-1',
          { version: 5, inicio: '2026-10-15T14:00' },
          CONTEXTO,
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          citaId: 'c-nueva',
          fecha: '2026-10-15',
          hora: '14:00',
        }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CITA_MEDICA_REPROGRAMADA',
          entidadId: 'c-nueva',
        }),
      );
    });

    it.each([
      ['versión vieja', new VersionCambioError()],
      ['cita ya reprogramada', new CitaNoDisponibleError()],
    ])('%s responde 409', async (_caso, error) => {
      repository.reprogramar.mockRejectedValue(error);
      await expect(
        service.reprogramar(
          'c-1',
          { version: 5, inicio: '2026-10-15T14:00' },
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(audit.registrar).not.toHaveBeenCalled();
    });
  });
});
