import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { fechaColumnaISO, nombreConPuesto } from '@akyuam/shared';
import type { AccionTrabajoSocialDto } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  IAccionesRepository,
  RegistrarAccionParams,
} from '../interfaces/acciones-repository.interface';

const SELECT_ACCION = {
  id: true,
  fecha: true,
  descripcion: true,
  createdAt: true,
  registradaPor: { select: { nombreCompleto: true, puesto: true } },
} satisfies Prisma.AccionTrabajoSocialSelect;

type FilaAccion = Prisma.AccionTrabajoSocialGetPayload<{
  select: typeof SELECT_ACCION;
}>;

function aDto(fila: FilaAccion): AccionTrabajoSocialDto {
  return {
    id: fila.id,
    fecha: fechaColumnaISO(fila.fecha),
    descripcion: fila.descripcion,
    registradaPor: nombreConPuesto(
      fila.registradaPor.nombreCompleto,
      fila.registradaPor.puesto,
    ),
    createdAt: fila.createdAt.toISOString(),
  };
}

@Injectable()
export class AccionesRepository implements IAccionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existeExpediente(expedienteId: string): Promise<boolean> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: { id: true },
    });
    return expediente !== null;
  }

  async listar(expedienteId: string): Promise<AccionTrabajoSocialDto[]> {
    const filas = await this.prisma.accionTrabajoSocial.findMany({
      where: { expedienteId },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      select: SELECT_ACCION,
    });
    return filas.map(aDto);
  }

  async registrar(
    params: RegistrarAccionParams,
  ): Promise<AccionTrabajoSocialDto> {
    const fila = await this.prisma.accionTrabajoSocial.create({
      data: {
        expedienteId: params.expedienteId,
        fecha: new Date(params.fecha),
        descripcion: params.descripcion,
        registradaPorId: params.registradaPorId,
      },
      select: SELECT_ACCION,
    });
    return aDto(fila);
  }
}
