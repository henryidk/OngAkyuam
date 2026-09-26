import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AtencionPsicologicaDetalle } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ActualizarEstadoAtencionParams,
  ExpedienteAccesoPsicologia,
  IAtencionPsicologicaRepository,
  ObtenerOCrearAtencionParams,
} from '../interfaces/atencion-psicologica-repository.interface';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';

const INCLUDE_ATENCION = {
  actualizadoPor: { select: { nombreCompleto: true } },
  citas: { include: INCLUDE_CITA, orderBy: { fechaHora: 'desc' } },
} satisfies Prisma.AtencionPsicologicaInclude;

type AtencionConRelaciones = Prisma.AtencionPsicologicaGetPayload<{
  include: typeof INCLUDE_ATENCION;
}>;

function mapearAtencion(
  atencion: AtencionConRelaciones,
): AtencionPsicologicaDetalle {
  return {
    id: atencion.id,
    expedienteId: atencion.expedienteId,
    estado: atencion.estado,
    actualizadoPor: atencion.actualizadoPor.nombreCompleto,
    actualizadoEn: atencion.updatedAt.toISOString(),
    citas: atencion.citas.map(mapearCita),
  };
}

@Injectable()
export class AtencionPsicologicaRepository implements IAtencionPsicologicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpedienteConAcceso(
    expedienteId: string,
  ): Promise<ExpedienteAccesoPsicologia | null> {
    return this.prisma.expediente.findFirst({
      where: { id: expedienteId, referidos: { some: { area: 'PSICOLOGIA' } } },
      select: { id: true },
    });
  }

  async obtenerOCrear(
    params: ObtenerOCrearAtencionParams,
  ): Promise<AtencionPsicologicaDetalle> {
    const atencion = await this.prisma.atencionPsicologica.upsert({
      where: { expedienteId: params.expedienteId },
      update: {},
      create: {
        expedienteId: params.expedienteId,
        actualizadoPorId: params.creadaPorId,
      },
      include: INCLUDE_ATENCION,
    });
    return mapearAtencion(atencion);
  }

  async actualizarEstado(
    params: ActualizarEstadoAtencionParams,
  ): Promise<AtencionPsicologicaDetalle> {
    // `upsert`, no `update`: si nunca se había consultado la atención (GET) antes del PATCH,
    // igual debe poder fijarse el estado en vez de fallar por "no encontrado".
    const atencion = await this.prisma.atencionPsicologica.upsert({
      where: { expedienteId: params.expedienteId },
      update: {
        estado: params.estado,
        actualizadoPorId: params.actualizadoPorId,
      },
      create: {
        expedienteId: params.expedienteId,
        estado: params.estado,
        actualizadoPorId: params.actualizadoPorId,
      },
      include: INCLUDE_ATENCION,
    });
    return mapearAtencion(atencion);
  }
}
