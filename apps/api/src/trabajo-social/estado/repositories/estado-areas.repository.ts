import { Injectable } from '@nestjs/common';
import type { EstadoProcesoJuridico } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AtencionPsicologicaParaEstado,
  IEstadoAreasRepository,
} from '../interfaces/estado-areas-repository.interface';

@Injectable()
export class EstadoAreasRepository implements IEstadoAreasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async estadosProcesosJuridicos(
    expedienteId: string,
  ): Promise<EstadoProcesoJuridico[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      select: { estado: true },
    });
    return procesos.map((proceso) => proceso.estado);
  }

  async atencionPsicologica(
    expedienteId: string,
  ): Promise<AtencionPsicologicaParaEstado | null> {
    const atencion = await this.prisma.atencionPsicologica.findUnique({
      where: { expedienteId },
      select: {
        estado: true,
        psicologaAsignada: { select: { nombreCompleto: true } },
        citas: {
          where: { estado: 'PROGRAMADA', fechaHora: { gte: new Date() } },
          orderBy: { fechaHora: 'asc' },
          take: 1,
          select: { fechaHora: true },
        },
      },
    });
    if (!atencion) {
      return null;
    }
    return {
      estado: atencion.estado,
      psicologa: atencion.psicologaAsignada?.nombreCompleto ?? null,
      proximaCita: atencion.citas[0]?.fechaHora ?? null,
    };
  }
}
