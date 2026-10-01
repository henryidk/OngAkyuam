import { Injectable } from '@nestjs/common';
import { fechaColumnaISO } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ExpedienteParaEgreso,
  IEgresoRepository,
} from '../interfaces/egreso-repository.interface';

@Injectable()
export class EgresoRepository implements IEgresoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpediente(
    expedienteId: string,
  ): Promise<ExpedienteParaEgreso | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: {
        tipoRegistro: true,
        fechaIngresoAlbergue: true,
        fechaEgresoAlbergue: true,
      },
    });
    if (!expediente) {
      return null;
    }

    return {
      tipoRegistro: expediente.tipoRegistro,
      fechaIngresoAlbergue: expediente.fechaIngresoAlbergue
        ? fechaColumnaISO(expediente.fechaIngresoAlbergue)
        : null,
      fechaEgresoAlbergue: expediente.fechaEgresoAlbergue
        ? fechaColumnaISO(expediente.fechaEgresoAlbergue)
        : null,
    };
  }

  async registrarEgreso(
    expedienteId: string,
    fechaEgreso: string,
  ): Promise<boolean> {
    // La condición va en el WHERE para que dos egresos simultáneos no se pisen: solo uno
    // encuentra la fila todavía sin fecha.
    const { count } = await this.prisma.expediente.updateMany({
      where: {
        id: expedienteId,
        tipoRegistro: 'INTERNA',
        fechaEgresoAlbergue: null,
      },
      data: { fechaEgresoAlbergue: new Date(fechaEgreso) },
    });
    return count === 1;
  }
}
