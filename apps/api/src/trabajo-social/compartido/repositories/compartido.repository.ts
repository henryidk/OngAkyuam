import { Injectable } from '@nestjs/common';
import type { Rol } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ICompartidoRepository,
  ProcesoJuridicoCompartido,
} from '../interfaces/compartido-repository.interface';

@Injectable()
export class CompartidoRepository implements ICompartidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async areasReferidas(expedienteId: string): Promise<Rol[] | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: { referidos: { select: { area: true } } },
    });
    return expediente
      ? expediente.referidos.map((referido) => referido.area)
      : null;
  }

  async procesosJuridicos(
    expedienteId: string,
  ): Promise<ProcesoJuridicoCompartido[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      orderBy: { fechaInicio: 'asc' },
      select: {
        tipo: true,
        fase: true,
        situacion: true,
        abogada: { select: { nombre: true } },
        procuradora: { select: { nombre: true } },
      },
    });
    return procesos.map((proceso) => ({
      tipo: proceso.tipo,
      fase: proceso.fase,
      situacion: proceso.situacion,
      abogada: proceso.abogada?.nombre ?? null,
      procuradora: proceso.procuradora?.nombre ?? null,
    }));
  }

  async proximaCitaPsicologica(expedienteId: string): Promise<Date | null> {
    // `select` solo de la fecha: el contenido clínico de la cita nunca sale de la base de datos.
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: {
        atencion: { expedienteId },
        estado: 'PROGRAMADA',
        fechaHora: { gte: new Date() },
      },
      orderBy: { fechaHora: 'asc' },
      select: { fechaHora: true },
    });
    return cita?.fechaHora ?? null;
  }
}
