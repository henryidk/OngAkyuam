import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ProcesoActivoPorTipo,
  ProcesoCreadoDto,
  ProcesoVinculadoDto,
  TipoProcesoJuridico,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EXPEDIENTE_REFERIDO_A_JURIDICO,
  PROCESO_ACTIVO,
  REFERENCIA_PENDIENTE,
} from '../compartido/acceso-juridico';
import { codigoProceso } from '../dominio/codigo-proceso';
import {
  PersonalInexistenteError,
  ReferenciaNoPendienteError,
  type CrearLoteParams,
  type IRegistroProcesosRepository,
} from '../interfaces/registro-procesos-repository.interface';

const INTENTOS_MAXIMOS = 3;

// P2002: dos lotes simultáneos eligieron el mismo consecutivo. P2034: Postgres abortó la
// transacción serializable por un conflicto. En ambos casos repetirla es seguro y suficiente.
const CODIGOS_REINTENTABLES = ['P2002', 'P2034'];

function codigoPrisma(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : null;
}

@Injectable()
export class RegistroProcesosRepository implements IRegistroProcesosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarActivosPorTipo(
    usuariaId: string,
    tipos?: TipoProcesoJuridico[],
  ): Promise<ProcesoActivoPorTipo[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: {
        expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_JURIDICO },
        ...PROCESO_ACTIVO,
        ...(tipos ? { tipo: { in: tipos } } : {}),
      },
      select: {
        tipo: true,
        consecutivo: true,
        expediente: { select: { numero: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return procesos.map((proceso) => ({
      tipo: proceso.tipo,
      codigo: codigoProceso(proceso.consecutivo, proceso.expediente.numero),
    }));
  }

  async listarVinculables(usuariaId: string): Promise<ProcesoVinculadoDto[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: {
        expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_JURIDICO },
      },
      select: {
        id: true,
        tipo: true,
        consecutivo: true,
        expediente: { select: { numero: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return procesos.map((proceso) => ({
      id: proceso.id,
      codigo: codigoProceso(proceso.consecutivo, proceso.expediente.numero),
      tipo: proceso.tipo,
    }));
  }

  async crearLote(params: CrearLoteParams): Promise<ProcesoCreadoDto[]> {
    for (let intento = 1; ; intento += 1) {
      try {
        return await this.crearLoteEnTransaccion(params);
      } catch (error) {
        const codigo = codigoPrisma(error);
        if (codigo === 'P2003') {
          throw new PersonalInexistenteError();
        }
        const reintentable =
          codigo !== null && CODIGOS_REINTENTABLES.includes(codigo);
        if (!reintentable || intento >= INTENTOS_MAXIMOS) {
          throw error;
        }
      }
    }
  }

  private crearLoteEnTransaccion(
    params: CrearLoteParams,
  ): Promise<ProcesoCreadoDto[]> {
    return this.prisma.$transaction(
      async (tx) => {
        // Bloquea la fila del expediente: dos lotes sobre el mismo expediente se ponen en
        // fila y cada uno ve el consecutivo que dejó el anterior.
        await tx.$queryRaw`SELECT id FROM "Expediente" WHERE id = ${params.expedienteId} FOR UPDATE`;

        const { _max } = await tx.procesoJuridico.aggregate({
          where: { expedienteId: params.expedienteId },
          _max: { consecutivo: true },
        });
        const ultimo = _max.consecutivo ?? 0;

        if (params.referidoId) {
          const { count } = await tx.referidoArea.updateMany({
            where: {
              ...REFERENCIA_PENDIENTE,
              id: params.referidoId,
              expedienteId: params.expedienteId,
            },
            data: { atendidoEn: new Date() },
          });
          if (count !== 1) {
            throw new ReferenciaNoPendienteError();
          }
        }

        const nuevos = params.procesos.map((proceso, indice) => ({
          ...proceso,
          id: randomUUID(),
          consecutivo: ultimo + indice + 1,
        }));

        await tx.procesoJuridico.createMany({
          data: nuevos.map((proceso) => ({
            id: proceso.id,
            expedienteId: params.expedienteId,
            consecutivo: proceso.consecutivo,
            tipo: proceso.tipo,
            // Tomar el caso ya es empezar a trabajarlo: no hay un paso manual a En proceso.
            fase: 'EN_PROCESO',
            abogadaId: proceso.abogadaId,
            procuradoraId: proceso.procuradoraId,
            contraparte: proceso.contraparte,
            fechaInicio: new Date(proceso.fechaInicio),
            procesoOrigenId: proceso.procesoOrigenId,
            referidoId: params.referidoId,
            creadoPorId: params.creadoPorId,
          })),
        });

        // Dos eventos con un milisegundo de diferencia para que la bitácora los muestre en orden.
        const creadoEn = new Date();
        const enProcesoEn = new Date(creadoEn.getTime() + 1);
        await tx.notaAvanceProceso.createMany({
          data: nuevos.flatMap((proceso) => [
            {
              procesoId: proceso.id,
              tipo: 'SISTEMA' as const,
              contenido: params.referidoId
                ? 'Proceso iniciado desde referencia de Trabajo Social'
                : 'Proceso creado',
              registradoPorId: params.creadoPorId,
              createdAt: creadoEn,
            },
            {
              procesoId: proceso.id,
              tipo: 'SISTEMA' as const,
              contenido: 'Marcado como En proceso al tomar el caso',
              registradoPorId: params.creadoPorId,
              createdAt: enProcesoEn,
            },
          ]),
        });

        return nuevos.map((proceso) => ({
          id: proceso.id,
          codigo: codigoProceso(proceso.consecutivo, params.numeroExpediente),
        }));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
