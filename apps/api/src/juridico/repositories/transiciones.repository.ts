import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ETIQUETAS_FORMA_FINALIZACION } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AbandonarParams,
  FinalizarParams,
  ITransicionesRepository,
  ReactivarParams,
  SuspenderParams,
  TransicionBase,
} from '../interfaces/transiciones-repository.interface';

/** Deshace la transacción cuando la versión ya no coincide; nunca sale del repositorio. */
class VersionDesactualizada extends Error {}

type Tx = Prisma.TransactionClient;

@Injectable()
export class TransicionesRepository implements ITransicionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  avanzar(params: TransicionBase): Promise<boolean> {
    return this.transicionar(params, 'Proceso marcado como En proceso', (tx) =>
      this.actualizarProceso(tx, params, { fase: 'EN_PROCESO' }),
    );
  }

  finalizar(params: FinalizarParams): Promise<boolean> {
    return this.transicionar(
      params,
      `Proceso finalizado por ${ETIQUETAS_FORMA_FINALIZACION[params.forma].toLowerCase()}`,
      (tx) =>
        this.actualizarProceso(tx, params, {
          fase: 'FINALIZADO',
          formaFinalizacion: params.forma,
          detalleFinalizacion: params.detalle,
          fechaCierre: new Date(params.fechaCierre),
        }),
    );
  }

  suspender(params: SuspenderParams): Promise<boolean> {
    return this.transicionar(params, 'Proceso suspendido', async (tx) => {
      await this.actualizarProceso(tx, params, { situacion: 'SUSPENDIDO' });
      await tx.suspensionProceso.create({
        data: {
          procesoId: params.procesoId,
          motivo: params.motivo,
          registradoPorId: params.usuarioId,
        },
      });
    });
  }

  abandonar(params: AbandonarParams): Promise<boolean> {
    return this.transicionar(
      params,
      'Se registró el abandono del proceso',
      async (tx) => {
        await this.actualizarProceso(tx, params, { situacion: 'ABANDONADO' });
        if (params.situacionActual === 'SUSPENDIDO') {
          await this.cerrarSuspensionVigente(tx, params.procesoId);
        }
        await tx.abandonoProceso.create({
          data: {
            procesoId: params.procesoId,
            fecha: new Date(params.fecha),
            motivoCatalogo: params.motivoCatalogo,
            motivo: params.observaciones,
            ultimoContacto: params.ultimoContacto
              ? new Date(params.ultimoContacto)
              : null,
            intentosContacto: params.intentosContacto,
            notificadoATs: params.notificadoATs,
            registradoPorId: params.usuarioId,
          },
        });
      },
    );
  }

  reactivar(params: ReactivarParams): Promise<boolean> {
    return this.transicionar(params, 'Proceso reactivado', async (tx) => {
      await this.actualizarProceso(tx, params, { situacion: 'ACTIVO' });
      // Las filas se cierran, no se borran: quedan como historial del proceso.
      if (params.situacionActual === 'SUSPENDIDO') {
        await this.cerrarSuspensionVigente(tx, params.procesoId);
      } else {
        await tx.abandonoProceso.updateMany({
          where: { procesoId: params.procesoId, reactivadoEn: null },
          data: { reactivadoEn: new Date() },
        });
      }
    });
  }

  private async transicionar(
    params: TransicionBase,
    textoBitacora: string,
    cambios: (tx: Tx) => Promise<void>,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await cambios(tx);
        await tx.notaAvanceProceso.create({
          data: {
            procesoId: params.procesoId,
            tipo: 'SISTEMA',
            contenido: textoBitacora,
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

  /**
   * `UPDATE … WHERE id AND version`: como toda transición sube la versión, que coincida
   * garantiza también que el estado sobre el que decidió la máquina sigue siendo el actual.
   */
  private async actualizarProceso(
    tx: Tx,
    params: TransicionBase,
    data: Prisma.ProcesoJuridicoUncheckedUpdateManyInput,
  ): Promise<void> {
    const { count } = await tx.procesoJuridico.updateMany({
      where: { id: params.procesoId, version: params.version },
      data: {
        ...data,
        version: { increment: 1 },
        ultimaActuacionEn: new Date(),
      },
    });
    if (count !== 1) {
      throw new VersionDesactualizada();
    }
  }

  private async cerrarSuspensionVigente(
    tx: Tx,
    procesoId: string,
  ): Promise<void> {
    await tx.suspensionProceso.updateMany({
      where: { procesoId, hasta: null },
      data: { hasta: new Date() },
    });
  }
}
