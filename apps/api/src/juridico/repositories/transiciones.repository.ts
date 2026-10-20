import { Injectable } from '@nestjs/common';
import type { OrigenCancelacionAudiencia, Prisma } from '@prisma/client';
import {
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_ORIGEN_CANCELACION,
  TIPO_ENTRADA_SISTEMA,
  formatInstanteGT,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AbandonarParams,
  FinalizarParams,
  ITransicionesRepository,
  ReactivarParams,
  SuspenderParams,
  TransicionAplicada,
  TransicionBase,
} from '../interfaces/transiciones-repository.interface';

/** Deshace la transacción cuando la versión ya no coincide; nunca sale del repositorio. */
class VersionDesactualizada extends Error {}

type Tx = Prisma.TransactionClient;

type OrigenCierre = Exclude<OrigenCancelacionAudiencia, 'MANUAL'>;

interface AudienciaCancelada {
  id: string;
  inicio: Date;
}

/** Lo que una transición cambió además del proceso: hoy, solo audiencias canceladas. */
type EfectosTransicion = AudienciaCancelada[] | void;

@Injectable()
export class TransicionesRepository implements ITransicionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  finalizar(params: FinalizarParams): Promise<TransicionAplicada | null> {
    return this.transicionar(
      params,
      `Proceso finalizado por ${ETIQUETAS_FORMA_FINALIZACION[params.forma].toLowerCase()}`,
      async (tx) => {
        await this.actualizarProceso(tx, params, {
          fase: 'FINALIZADO',
          formaFinalizacion: params.forma,
          detalleFinalizacion: params.detalle,
          fechaCierre: new Date(params.fechaCierre),
        });
        return this.cancelarProgramadas(tx, params, 'PROCESO_FINALIZADO');
      },
    );
  }

  suspender(params: SuspenderParams): Promise<TransicionAplicada | null> {
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

  abandonar(params: AbandonarParams): Promise<TransicionAplicada | null> {
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
        return this.cancelarProgramadas(tx, params, 'PROCESO_ABANDONADO');
      },
    );
  }

  // Reactivar no restaura las audiencias canceladas: se agendan de nuevo si hacen falta.
  reactivar(params: ReactivarParams): Promise<TransicionAplicada | null> {
    return this.transicionar(params, 'Proceso reactivado', async (tx) => {
      await this.actualizarProceso(tx, params, {
        situacion: 'ACTIVO',
        ...(params.faseActual === 'INICIADO' && { fase: 'EN_PROCESO' }),
      });
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
    cambios: (tx: Tx) => Promise<EfectosTransicion>,
  ): Promise<TransicionAplicada | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const canceladas = (await cambios(tx)) ?? [];
        await this.anotar(tx, params, textoBitacora);
        return { audienciasCanceladas: canceladas.map((a) => a.id) };
      });
    } catch (error) {
      if (error instanceof VersionDesactualizada) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Un proceso cerrado no conserva audiencias pendientes: las PROGRAMADAS pasan a CANCELADA
   * con su origen, cada una con su línea en la bitácora. Corre después de actualizar el
   * proceso, que ya bloqueó su fila: ninguna escritura de audiencias se cuela en medio.
   */
  private async cancelarProgramadas(
    tx: Tx,
    params: TransicionBase,
    origen: OrigenCierre,
  ): Promise<AudienciaCancelada[]> {
    const programadas = await tx.audienciaJuridica.findMany({
      where: { procesoId: params.procesoId, estado: 'PROGRAMADA' },
      select: { id: true, inicio: true },
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    });
    if (programadas.length === 0) {
      return [];
    }
    const etiqueta = ETIQUETAS_ORIGEN_CANCELACION[origen];
    await tx.audienciaJuridica.updateMany({
      where: {
        id: { in: programadas.map((a) => a.id) },
        estado: 'PROGRAMADA',
      },
      data: {
        estado: 'CANCELADA',
        origenCancelacion: origen,
        motivo: etiqueta,
        version: { increment: 1 },
      },
    });
    for (const audiencia of programadas) {
      await this.anotar(
        tx,
        params,
        `Audiencia del ${formatInstanteGT(audiencia.inicio)} ${etiqueta.toLowerCase()}`,
      );
    }
    return programadas;
  }

  private async anotar(
    tx: Tx,
    params: TransicionBase,
    contenido: string,
  ): Promise<void> {
    await tx.notaAvanceProceso.create({
      data: {
        procesoId: params.procesoId,
        tipo: TIPO_ENTRADA_SISTEMA,
        esSistema: true,
        contenido,
        registradoPorId: params.usuarioId,
      },
    });
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
