import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';

/** Procesos de una psicóloga, o de toda el área si es `null`. */
function delAlcance(
  psicologaId: string | null,
): Prisma.AtencionPsicologicaWhereInput {
  return psicologaId ? { psicologaAsignadaId: psicologaId } : {};
}

@Injectable()
export class AtencionPsicologicaRepository implements IAtencionPsicologicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fechaPrimerProceso(psicologaId: string | null): Promise<Date | null> {
    const primero = await this.prisma.atencionPsicologica.findFirst({
      where: delAlcance(psicologaId),
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return primero?.createdAt ?? null;
  }

  async contarCasosActivos(psicologaId: string | null): Promise<number> {
    return this.prisma.atencionPsicologica.count({
      where: { ...delAlcance(psicologaId), estado: { not: 'CIERRE' } },
    });
  }

  async contarIniciadosEnRango(
    psicologaId: string | null,
    desde: Date,
    hasta: Date,
  ): Promise<number> {
    return this.prisma.atencionPsicologica.count({
      where: {
        ...delAlcance(psicologaId),
        createdAt: { gte: desde, lte: hasta },
      },
    });
  }

  async contarCerradosEnRango(
    psicologaId: string | null,
    desde: Date,
    hasta: Date,
  ): Promise<number> {
    return this.prisma.atencionPsicologica.count({
      where: {
        ...delAlcance(psicologaId),
        estado: 'CIERRE',
        fechaCierre: { gte: desde, lte: hasta },
      },
    });
  }
}
