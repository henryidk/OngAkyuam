import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hoyGT, type RegistrarConsultaMedicaInput } from '@akyuam/shared';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { PrismaService } from '../prisma/prisma.service';
import { MedicinaService, PERFIL_MEDICO_VACIO } from './medicina.service';

describe('Medicina: referencias y registros reales', () => {
  const usuario: AuthenticatedUser = {
    id: 'medica-test',
    username: 'medica',
    nombreCompleto: 'Profesional de prueba',
    rol: 'MEDICA',
    mustChangePassword: false,
  };
  const cita = {
    expedienteId: 'expediente-test',
    isoDate: hoyGT(),
    time: '10:00',
    place: 'Clínica',
    reason: 'Consulta',
  };
  const nota: RegistrarConsultaMedicaInput = {
    reason: 'Consulta',
    physicalExam: '',
    evolution: '',
    plan: 'Seguimiento',
    diagnoses: [{ code: 'Z00.0', label: 'Examen general' }],
    prescriptions: [],
    history: PERFIL_MEDICO_VACIO.history,
  };
  let service: MedicinaService;
  let tx: {
    expediente: { findFirst: jest.Mock; findMany: jest.Mock };
    atencionMedica: { upsert: jest.Mock; update: jest.Mock };
    citaMedica: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
  };
  beforeEach(() => {
    tx = {
      expediente: {
        findFirst: jest.fn().mockResolvedValue({ id: cita.expedienteId }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      atencionMedica: {
        upsert: jest.fn().mockResolvedValue({ id: 'atencion-test' }),
        update: jest.fn(),
      },
      citaMedica: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cita-test',
          fecha: new Date(cita.isoDate + 'T00:00:00Z'),
          atencionId: 'atencion-test',
          atencion: {
            expedienteId: cita.expedienteId,
            perfil: PERFIL_MEDICO_VACIO,
          },
        }),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      ...tx,
      $transaction: (action: (client: typeof tx) => Promise<unknown>) =>
        action(tx),
    } as unknown as PrismaService;
    service = new MedicinaService(prisma);
  });

  it('una base sin referencias devuelve listas vacías, sin pacientes ni citas de ejemplo', async () => {
    await expect(service.workspace(usuario)).resolves.toEqual({
      patients: [],
      consultations: [],
      referrals: [],
    });
    expect(tx.expediente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { referidos: { some: { area: 'MEDICA' } } },
      }),
    );
  });

  it('conserva la usuaria referida sin inventar diagnósticos ni atenciones y no desplaza las fechas', async () => {
    tx.expediente.findMany.mockResolvedValue([
      {
        id: cita.expedienteId,
        numero: '1-2026',
        usuaria: {
          nombres: 'Paciente',
          apellidos: 'De prueba',
          fechaNacimiento: new Date('2000-01-01T00:00:00Z'),
          municipio: 'Cobán',
          municipioOtro: null,
          telefono: null,
        },
        referidos: [
          {
            id: 'referencia-test',
            createdAt: new Date('2026-10-01T02:00:00Z'),
            otorgadoPor: { nombreCompleto: 'Trabajo Social' },
          },
        ],
        atencionMedica: null,
      },
    ]);
    const data = await service.workspace(usuario);
    expect(data.patients).toHaveLength(1);
    expect(data.patients[0]).toMatchObject({
      id: '1-2026',
      expedienteId: cita.expedienteId,
      referredOn: '2026-09-30',
      allergies: [],
      history: PERFIL_MEDICO_VACIO.history,
    });
    expect(data.referrals).toHaveLength(1);
    expect(data.consultations).toEqual([]);
  });

  it('impide agendar o editar el perfil de un expediente sin referencia a Medicina', async () => {
    tx.expediente.findFirst.mockResolvedValue(null);
    await expect(service.programar(cita, usuario)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.perfil(cita.expedienteId, PERFIL_MEDICO_VACIO, usuario),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.atencionMedica.upsert).not.toHaveBeenCalled();
    expect(tx.citaMedica.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('impide registrar una atención o ausencia para un expediente ajeno', async () => {
    tx.expediente.findFirst.mockResolvedValue(null);
    await expect(
      service.atender('cita-test', nota, usuario),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.atender('cita-test', null, usuario),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.citaMedica.updateMany).not.toHaveBeenCalled();
    expect(tx.atencionMedica.update).not.toHaveBeenCalled();
  });

  it('no sobrescribe una cita que ya fue atendida ni modifica su perfil', async () => {
    tx.citaMedica.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.atender('cita-test', nota, usuario),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.atencionMedica.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rechaza una reprogramación si la cita no corresponde al expediente', async () => {
    tx.citaMedica.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.programar(cita, usuario, 'cita-ajena'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.citaMedica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'cita-ajena',
          atencionId: 'atencion-test',
          estado: 'Programada',
        },
      }),
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rechaza citas futuras al atender o marcar ausente', async () => {
    tx.citaMedica.findUnique.mockResolvedValue({
      fecha: new Date('9999-12-31T00:00:00Z'),
      atencion: { expedienteId: cita.expedienteId },
    });
    await expect(
      service.atender('cita-test', null, usuario),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.citaMedica.updateMany).not.toHaveBeenCalled();
  });

  it('traduce una colisión de horario en un error claro', async () => {
    tx.citaMedica.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    await expect(service.programar(cita, usuario)).rejects.toThrow(
      'Ya tiene una consulta en esa fecha y hora',
    );
  });
});
