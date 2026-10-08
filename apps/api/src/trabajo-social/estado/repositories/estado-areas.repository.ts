import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AtencionPsicologicaParaEstado,
  IEstadoAreasRepository,
  ProcesoJuridicoParaEstado,
} from '../interfaces/estado-areas-repository.interface';

@Injectable()
export class EstadoAreasRepository implements IEstadoAreasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async procesosJuridicos(
    expedienteId: string,
  ): Promise<ProcesoJuridicoParaEstado[]> {
    return this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      select: { fase: true, situacion: true },
    });
  }

  async atencionPsicologica(
    expedienteId: string,
  ): Promise<AtencionPsicologicaParaEstado | null> {
    // Con varios procesos en el expediente manda el más reciente: si la usuaria regresó y hay
    // uno abierto, el área vuelve a estar en atención aunque el anterior esté cerrado.
    const atencion = await this.prisma.atencionPsicologica.findFirst({
      where: { expedienteId },
      orderBy: { consecutivo: 'desc' },
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
