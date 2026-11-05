import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  MotivoCierrePsicologia,
  ProfesionalReportePsicologia,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IAtencionPsicologicaRepository,
  ResultadoTomarCaso,
  TomarCasoParams,
} from '../interfaces/atencion-psicologica-repository.interface';
import {
  SERIALIZABLE,
  conReintentos,
  siguienteConsecutivoProceso,
} from './transaccion-psicologia';

/** Procesos de una psicóloga, o de toda el área si es `null`. */
function delAlcance(
  psicologaId: string | null,
): Prisma.AtencionPsicologicaWhereInput {
  return psicologaId ? { psicologaAsignadaId: psicologaId } : {};
}

@Injectable()
export class AtencionPsicologicaRepository implements IAtencionPsicologicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Una transacción serializable con el expediente bloqueado, igual que abrir un proceso en
   * Jurídico o Médica: dos psicólogas que toman el mismo caso a la vez se ponen en fila, y la
   * segunda ve el caso ya tomado. El índice único ("un solo proceso sin cerrar por expediente")
   * sigue de respaldo: si aun así choca tras los reintentos, la otra lo tomó primero.
   */
  async tomarCaso(params: TomarCasoParams): Promise<ResultadoTomarCaso> {
    try {
      return await conReintentos(() =>
        this.prisma.$transaction(
          (tx) => this.tomarCasoEnTransaccion(tx, params),
          SERIALIZABLE,
        ),
      );
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

  private async tomarCasoEnTransaccion(
    tx: Prisma.TransactionClient,
    params: TomarCasoParams,
  ): Promise<ResultadoTomarCaso> {
    await tx.$queryRaw`SELECT id FROM "Expediente" WHERE id = ${params.expedienteId} FOR UPDATE`;

    const referido = await tx.referidoArea.findUnique({
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

    // Atención sin dueña que quedó de antes del rediseño: se reclama esa en lugar de crear otra.
    const reclamadas = await tx.atencionPsicologica.updateMany({
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

    const yaTomada = await tx.atencionPsicologica.count({
      where: {
        expedienteId: params.expedienteId,
        psicologaAsignadaId: { not: null },
      },
    });
    if (yaTomada > 0) {
      return 'YA_TOMADO';
    }

    // El caso se toma en el lugar de la usuaria; si su primera cita es para un hijo/a, se
    // renumera al abrirlo.
    await tx.atencionPsicologica.create({
      data: {
        expedienteId: params.expedienteId,
        consecutivo: await siguienteConsecutivoProceso(
          tx,
          params.expedienteId,
          null,
        ),
        ...reclamo,
      },
    });
    return 'TOMADO';
  }

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

  async contarCerradosPorMotivo(
    psicologaId: string | null,
    desde: Date,
    hasta: Date,
  ): Promise<{ motivo: MotivoCierrePsicologia | null; total: number }[]> {
    const grupos = await this.prisma.atencionPsicologica.groupBy({
      by: ['motivoCierreCatalogo'],
      where: {
        ...delAlcance(psicologaId),
        estado: 'CIERRE',
        fechaCierre: { gte: desde, lte: hasta },
      },
      _count: { _all: true },
    });
    return grupos.map((grupo) => ({
      motivo: grupo.motivoCierreCatalogo,
      total: grupo._count._all,
    }));
  }

  async listarPsicologas(): Promise<ProfesionalReportePsicologia[]> {
    const cuentas = await this.prisma.usuario.findMany({
      where: { rol: 'PSICOLOGIA' },
      orderBy: { nombreCompleto: 'asc' },
      select: { id: true, nombreCompleto: true, isActive: true },
    });
    return cuentas.map((cuenta) => ({
      id: cuenta.id,
      nombre: cuenta.nombreCompleto,
      activo: cuenta.isActive,
    }));
  }
}
