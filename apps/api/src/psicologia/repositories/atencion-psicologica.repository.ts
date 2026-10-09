import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IAtencionPsicologicaRepository,
  ResultadoTomarCaso,
  TomarCasoParams,
} from '../interfaces/atencion-psicologica-repository.interface';

@Injectable()
export class AtencionPsicologicaRepository implements IAtencionPsicologicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async tomarCaso(params: TomarCasoParams): Promise<ResultadoTomarCaso> {
    const referido = await this.prisma.referidoArea.findUnique({
      where: {
        expedienteId_area: {
          expedienteId: params.expedienteId,
          area: 'PSICOLOGIA',
        },
      },
      select: { id: true },
    });
    if (!referido) {
      return 'YA_TOMADO';
    }

    const reclamo = {
      psicologaAsignadaId: params.psicologaId,
      tomadaEn: new Date(),
      actualizadoPorId: params.psicologaId,
      referidoId: referido.id,
    };

    // Atención sin dueña que quedó de antes del rediseño. Update condicional: el `WHERE
    // psicologaAsignadaId IS NULL` re-evaluado por Postgres bajo el lock de fila hace que, si
    // dos requests llegan aquí a la vez, solo uno afecte una fila.
    const reclamadas = await this.prisma.atencionPsicologica.updateMany({
      where: {
        expedienteId: params.expedienteId,
        psicologaAsignadaId: null,
        estado: { not: 'CIERRE' },
      },
      data: { ...reclamo, version: { increment: 1 } },
    });
    if (reclamadas.count === 1) {
      return 'TOMADO';
    }

    const yaTomada = await this.prisma.atencionPsicologica.count({
      where: {
        expedienteId: params.expedienteId,
        psicologaAsignadaId: { not: null },
      },
    });
    if (yaTomada > 0) {
      return 'YA_TOMADO';
    }

    // Crear la atención ya con dueña es el reclamo en sí. Si dos psicólogas compiten, el índice
    // único de la base ("un solo proceso sin cerrar por expediente") hace fallar a la segunda
    // con P2002 — nunca se asume que "falló" significa "gané yo".
    try {
      await this.prisma.atencionPsicologica.create({
        data: {
          expedienteId: params.expedienteId,
          consecutivo: await this.siguienteConsecutivo(params.expedienteId),
          ...reclamo,
        },
      });
      return 'TOMADO';
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return 'YA_TOMADO';
      }
      throw error;
    }
  }

  async contarCasosActivos(psicologaId: string): Promise<number> {
    return this.prisma.atencionPsicologica.count({
      where: { psicologaAsignadaId: psicologaId, estado: { not: 'CIERRE' } },
    });
  }

  async contarIniciadosEnRango(
    psicologaId: string,
    desde: Date,
    hasta: Date,
  ): Promise<number> {
    return this.prisma.atencionPsicologica.count({
      where: {
        psicologaAsignadaId: psicologaId,
        createdAt: { gte: desde, lte: hasta },
      },
    });
  }

  async contarCerradosEnRango(
    psicologaId: string,
    desde: Date,
    hasta: Date,
  ): Promise<number> {
    return this.prisma.atencionPsicologica.count({
      where: {
        psicologaAsignadaId: psicologaId,
        estado: 'CIERRE',
        fechaCierre: { gte: desde, lte: hasta },
      },
    });
  }

  private async siguienteConsecutivo(expedienteId: string): Promise<number> {
    const { _max } = await this.prisma.atencionPsicologica.aggregate({
      where: { expedienteId },
      _max: { consecutivo: true },
    });
    return (_max.consecutivo ?? 0) + 1;
  }
}
