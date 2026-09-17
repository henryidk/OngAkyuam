import { Injectable } from '@nestjs/common';
import type { NotaAvanceDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearNotaAvanceParams,
  INotasAvanceRepository,
} from '../interfaces/notas-avance-repository.interface';

function mapearNota(nota: {
  id: string;
  contenido: string;
  createdAt: Date;
  registradoPor: { nombreCompleto: string };
}): NotaAvanceDto {
  return {
    id: nota.id,
    contenido: nota.contenido,
    registradoPor: nota.registradoPor.nombreCompleto,
    createdAt: nota.createdAt.toISOString(),
  };
}

@Injectable()
export class NotasAvanceRepository implements INotasAvanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(params: CrearNotaAvanceParams): Promise<NotaAvanceDto> {
    const nota = await this.prisma.notaAvanceProceso.create({
      data: {
        procesoId: params.procesoId,
        contenido: params.contenido,
        registradoPorId: params.registradoPorId,
      },
      include: { registradoPor: { select: { nombreCompleto: true } } },
    });
    return mapearNota(nota);
  }

  async listarPorProceso(procesoId: string): Promise<NotaAvanceDto[]> {
    const notas = await this.prisma.notaAvanceProceso.findMany({
      where: { procesoId },
      include: { registradoPor: { select: { nombreCompleto: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return notas.map(mapearNota);
  }
}
