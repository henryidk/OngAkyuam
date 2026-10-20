import { Injectable } from '@nestjs/common';
import {
  TIPO_ENTRADA_SISTEMA,
  etiquetaProceso,
  type ProcesoVinculadoDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESO_CON_ACCESO } from '../compartido/acceso-juridico';
import type {
  AsignarNumeroJudicialParams,
  INumeroJudicialRepository,
} from '../interfaces/numero-judicial-repository.interface';

/** Deshace la transacción cuando la versión ya no coincide; nunca sale del repositorio. */
class VersionDesactualizada extends Error {}

@Injectable()
export class NumeroJudicialRepository implements INumeroJudicialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarProcesosConNumero(
    numeroJudicial: string,
    exceptoProcesoId: string,
  ): Promise<ProcesoVinculadoDto[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: {
        ...PROCESO_CON_ACCESO,
        id: { not: exceptoProcesoId },
        numeroJudicial: { equals: numeroJudicial, mode: 'insensitive' },
      },
      select: {
        id: true,
        consecutivo: true,
        tipo: true,
        expediente: { select: { numero: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return procesos.map((proceso) => ({
      id: proceso.id,
      codigo: etiquetaProceso(proceso.expediente.numero, proceso.consecutivo),
      tipo: proceso.tipo,
    }));
  }

  async asignar(params: AsignarNumeroJudicialParams): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // La versión en el WHERE garantiza que el número anterior es el que leyó el servicio
        // (de él sale "registró" o "corrigió") y que no se pisa un cambio ajeno. Como al
        // editar los datos, no cuenta como actuación: no toca `ultimaActuacionEn`.
        const { count } = await tx.procesoJuridico.updateMany({
          where: { id: params.procesoId, version: params.version },
          data: {
            numeroJudicial: params.numeroJudicial,
            version: { increment: 1 },
          },
        });
        if (count !== 1) {
          throw new VersionDesactualizada();
        }
        await tx.notaAvanceProceso.create({
          data: {
            procesoId: params.procesoId,
            tipo: TIPO_ENTRADA_SISTEMA,
            esSistema: true,
            contenido: params.textoBitacora,
            registradoPorId: params.usuarioId,
          },
        });
      });
      return true;
    } catch (error) {
      if (error instanceof VersionDesactualizada) {
        return false;
      }
      throw error;
    }
  }
}
