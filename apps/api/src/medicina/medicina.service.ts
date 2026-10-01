import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  edadEnAniosGT,
  fechaColumnaISO,
  formatFechaGT,
  formatInstanteGT,
  hoyGT,
  perfilMedicoSchema,
  registrarConsultaMedicaSchema,
  type MedicinaWorkspaceData,
  type PerfilMedico,
  type ProgramarConsultaMedicaInput,
  type RegistrarConsultaMedicaInput,
} from '@akyuam/shared';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

export const PERFIL_MEDICO_VACIO: PerfilMedico = {
  bloodType: '',
  allergies: [],
  chronicConditions: [],
  history: {
    personal: '',
    surgical: '',
    gyneco: '',
    family: '',
    medication: '',
  },
};
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class MedicinaService {
  constructor(private readonly prisma: PrismaService) {}

  private async acceso(tx: Prisma.TransactionClient, expedienteId: string) {
    const expediente = await tx.expediente.findFirst({
      where: { id: expedienteId, referidos: { some: { area: 'MEDICA' } } },
      select: { id: true },
    });
    if (!expediente)
      throw new ForbiddenException('No tiene acceso a este expediente');
  }

  async workspace(usuario: AuthenticatedUser): Promise<MedicinaWorkspaceData> {
    const expedientes = await this.prisma.expediente.findMany({
      where: { referidos: { some: { area: 'MEDICA' } } },
      include: {
        usuaria: true,
        referidos: {
          where: { area: 'MEDICA' },
          include: { otorgadoPor: { select: { nombreCompleto: true } } },
        },
        atencionMedica: {
          include: {
            citas: {
              include: { atendidoPor: { select: { nombreCompleto: true } } },
              orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const data: MedicinaWorkspaceData = {
      patients: [],
      consultations: [],
      referrals: [],
    };
    for (const expediente of expedientes) {
      const referencia = expediente.referidos[0];
      const citas = expediente.atencionMedica?.citas ?? [];
      const perfil = expediente.atencionMedica
        ? perfilMedicoSchema.parse(expediente.atencionMedica.perfil)
        : PERFIL_MEDICO_VACIO;
      const name = `${expediente.usuaria.nombres} ${expediente.usuaria.apellidos}`;
      const patient = {
        ...perfil,
        id: expediente.numero,
        expedienteId: expediente.id,
        name,
        birthDate: fechaColumnaISO(expediente.usuaria.fechaNacimiento),
        age: edadEnAniosGT(fechaColumnaISO(expediente.usuaria.fechaNacimiento)),
        municipality:
          expediente.usuaria.municipioOtro ??
          expediente.usuaria.municipio ??
          'Sin registrar',
        phone: expediente.usuaria.telefono ?? '',
        status: citas.some((cita) => cita.estado === 'Atendida')
          ? ('En tratamiento' as const)
          : ('Nuevo ingreso' as const),
        referredBy: referencia.otorgadoPor.nombreCompleto,
        referredOn: formatInstanteGT(referencia.createdAt)
          .slice(0, 10)
          .split('/')
          .reverse()
          .join('-'),
      };
      data.patients.push(patient);
      if (
        !citas.some(
          (cita) => cita.estado === 'Programada' || cita.estado === 'Atendida',
        )
      ) {
        data.referrals.push({
          id: referencia.id,
          patientId: patient.id,
          patientName: name,
          age: patient.age,
          municipality: patient.municipality,
          received: formatInstanteGT(referencia.createdAt),
          reason: '',
          socialWorker: patient.referredBy,
          note: '',
        });
      }
      for (const cita of citas) {
        const nota = cita.nota
          ? registrarConsultaMedicaSchema.parse(cita.nota)
          : undefined;
        const isoDate = fechaColumnaISO(cita.fecha);
        data.consultations.push({
          ...nota,
          id: cita.id,
          isoDate,
          dateLabel: formatFechaGT(fechaColumnaISO(cita.fecha)),
          time: cita.hora,
          patientId: patient.id,
          patientName: name,
          reason: cita.motivo,
          place: cita.lugar,
          status: cita.estado as 'Programada' | 'Atendida' | 'Ausente',
          type: citas.some(
            (prev) =>
              prev.estado === 'Atendida' &&
              `${fechaColumnaISO(prev.fecha)}${prev.hora}` <
                `${isoDate}${cita.hora}`,
          )
            ? 'Reconsulta'
            : 'Primera consulta',
          professional: cita.atendidoPor.nombreCompleto,
        });
      }
    }
    data.consultations.sort((a, b) =>
      `${a.isoDate}${a.time}`.localeCompare(`${b.isoDate}${b.time}`),
    );
    await this.prisma.auditLog.create({
      data: {
        usuarioId: usuario.id,
        username: usuario.username,
        accion: 'MEDICINA_CONSULTADA',
        entidad: 'AtencionMedica',
      },
    });
    return data;
  }

  private async cambiar<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Ya tiene una consulta en esa fecha y hora',
        );
      throw error;
    }
  }

  async programar(
    input: ProgramarConsultaMedicaInput,
    usuario: AuthenticatedUser,
    citaId?: string,
  ) {
    if (input.isoDate < hoyGT())
      throw new ConflictException(
        'La fecha de la cita no puede ser anterior a hoy',
      );
    return this.cambiar(() =>
      this.prisma.$transaction(async (tx) => {
        await this.acceso(tx, input.expedienteId);
        const atencion = await tx.atencionMedica.upsert({
          where: { expedienteId: input.expedienteId },
          create: {
            expedienteId: input.expedienteId,
            perfil: json(PERFIL_MEDICO_VACIO),
          },
          update: {},
        });
        const datos = {
          fecha: new Date(input.isoDate + 'T00:00:00Z'),
          hora: input.time,
          lugar: input.place,
          motivo: input.reason,
        };
        if (citaId) {
          const resultado = await tx.citaMedica.updateMany({
            where: {
              id: citaId,
              atencionId: atencion.id,
              estado: 'Programada',
            },
            data: datos,
          });
          if (!resultado.count)
            throw new ForbiddenException(
              'No tiene acceso a una cita programada con ese identificador',
            );
        } else {
          await tx.citaMedica.create({
            data: {
              ...datos,
              atencionId: atencion.id,
              atendidoPorId: usuario.id,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            usuarioId: usuario.id,
            username: usuario.username,
            accion: citaId ? 'CITA_MEDICA_REPROGRAMADA' : 'CITA_MEDICA_CREADA',
            entidad: 'Expediente',
            entidadId: input.expedienteId,
          },
        });
        return { ok: true };
      }),
    );
  }

  async atender(
    citaId: string,
    input: RegistrarConsultaMedicaInput | null,
    usuario: AuthenticatedUser,
  ) {
    return this.cambiar(() =>
      this.prisma.$transaction(async (tx) => {
        const cita = await tx.citaMedica.findUnique({
          where: { id: citaId },
          include: { atencion: true },
        });
        if (!cita) throw new ForbiddenException('No tiene acceso a esta cita');
        await this.acceso(tx, cita.atencion.expedienteId);
        if (fechaColumnaISO(cita.fecha) > hoyGT())
          throw new ConflictException('No se puede atender una cita futura');
        const resultado = await tx.citaMedica.updateMany({
          where: { id: citaId, estado: 'Programada' },
          data: input
            ? {
                estado: 'Atendida',
                motivo: input.reason,
                nota: json(input),
                atendidoPorId: usuario.id,
              }
            : { estado: 'Ausente' },
        });
        if (!resultado.count)
          throw new ConflictException(
            'La cita ya fue atendida o marcada ausente',
          );
        if (input) {
          const perfil = perfilMedicoSchema.parse(cita.atencion.perfil);
          await tx.atencionMedica.update({
            where: { id: cita.atencionId },
            data: { perfil: json({ ...perfil, history: input.history }) },
          });
          if (input.nextDate) {
            if (
              input.nextDate <= fechaColumnaISO(cita.fecha) ||
              input.nextDate < hoyGT()
            )
              throw new ConflictException(
                'El seguimiento debe ser posterior a la consulta',
              );
            await tx.citaMedica.create({
              data: {
                atencionId: cita.atencionId,
                fecha: new Date(input.nextDate + 'T00:00:00Z'),
                hora: cita.hora,
                lugar: cita.lugar,
                motivo: 'Reconsulta de seguimiento',
                atendidoPorId: usuario.id,
              },
            });
          }
        }
        await tx.auditLog.create({
          data: {
            usuarioId: usuario.id,
            username: usuario.username,
            accion: input
              ? 'CONSULTA_MEDICA_REGISTRADA'
              : 'CITA_MEDICA_AUSENTE',
            entidad: 'CitaMedica',
            entidadId: citaId,
          },
        });
        return { ok: true };
      }),
    );
  }

  async perfil(
    expedienteId: string,
    input: PerfilMedico,
    usuario: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.acceso(tx, expedienteId);
      await tx.atencionMedica.upsert({
        where: { expedienteId },
        create: { expedienteId, perfil: json(input) },
        update: { perfil: json(input) },
      });
      await tx.auditLog.create({
        data: {
          usuarioId: usuario.id,
          username: usuario.username,
          accion: 'PERFIL_MEDICO_ACTUALIZADO',
          entidad: 'Expediente',
          entidadId: expedienteId,
        },
      });
      return { ok: true };
    });
  }
}
