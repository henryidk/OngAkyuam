import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OtroProcesoActivoError,
  ProcesoNoDisponibleError,
  ProcesoYaAbiertoError,
} from '../interfaces/procesos-psicologia-repository.interface';
import type {
  AbrirProcesoParams,
  AccesoProcesoPsicologia,
  ActualizarVisibilidadParams,
  CerrarProcesoParams,
  IProcesosPsicologiaRepository,
  ProcesoAbierto,
  ProcesoCerrado,
} from '../interfaces/procesos-psicologia-repository.interface';

const INTENTOS_MAXIMOS = 3;

// P2034: Postgres abortó la transacción serializable por un conflicto con otra simultánea.
// P2002: chocó con un índice único por la misma carrera. Repetirla es seguro: la segunda vuelta
// ya ve lo que escribió la otra y responde con el error de negocio que corresponde.
const CODIGOS_REINTENTABLES = ['P2002', 'P2034'];

function esReintentable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CODIGOS_REINTENTABLES.includes(error.code)
  );
}

@Injectable()
export class ProcesosPsicologiaRepository implements IProcesosPsicologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarAccesoProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<AccesoProcesoPsicologia | null> {
    const proceso = await this.prisma.atencionPsicologica.findFirst({
      where: { id: procesoId, psicologaAsignadaId: psicologaId },
      select: {
        id: true,
        expedienteId: true,
        consecutivo: true,
        estado: true,
        version: true,
        expediente: { select: { numero: true, usuariaId: true } },
      },
    });
    if (!proceso) {
      return null;
    }
    return {
      id: proceso.id,
      expedienteId: proceso.expedienteId,
      expedienteNumero: proceso.expediente.numero,
      usuariaId: proceso.expediente.usuariaId,
      consecutivo: proceso.consecutivo,
      etapa: proceso.estado,
      version: proceso.version,
    };
  }

  async ninoPerteneceAExpediente(
    ninoId: string,
    expedienteId: string,
  ): Promise<boolean> {
    const nino = await this.prisma.nino.findFirst({
      where: { id: ninoId, expedienteId },
      select: { id: true },
    });
    return nino !== null;
  }

  async abrir(params: AbrirProcesoParams): Promise<ProcesoAbierto> {
    for (let intento = 1; ; intento += 1) {
      try {
        return await this.abrirEnTransaccion(params);
      } catch (error) {
        if (intento >= INTENTOS_MAXIMOS || !esReintentable(error)) {
          throw error;
        }
      }
    }
  }

  private abrirEnTransaccion(
    params: AbrirProcesoParams,
  ): Promise<ProcesoAbierto> {
    return this.prisma.$transaction(
      async (tx) => {
        const proceso = await tx.atencionPsicologica.findFirst({
          where: {
            id: params.procesoId,
            psicologaAsignadaId: params.psicologaId,
            estado: { not: 'CIERRE' },
          },
          select: {
            id: true,
            consecutivo: true,
            estado: true,
            _count: { select: { citas: true } },
          },
        });
        if (!proceso) {
          throw new ProcesoNoDisponibleError();
        }
        if (proceso._count.citas > 0) {
          throw new ProcesoYaAbiertoError();
        }

        // "Un solo proceso abierto por usuaria" cruza expedientes: la base no puede
        // garantizarlo con un índice, así que se comprueba aquí, bajo aislamiento serializable.
        const otroAbierto = await tx.atencionPsicologica.findFirst({
          where: {
            id: { not: proceso.id },
            estado: { not: 'CIERRE' },
            fechaInicio: { not: null },
            expediente: { usuariaId: params.usuariaId },
          },
          select: { id: true },
        });
        if (otroAbierto) {
          throw new OtroProcesoActivoError();
        }

        await tx.atencionPsicologica.update({
          where: { id: proceso.id },
          data: {
            fechaInicio: new Date(),
            actualizadoPorId: params.psicologaId,
            version: { increment: 1 },
          },
        });
        await tx.cambioEstadoAtencion.create({
          data: {
            atencionId: proceso.id,
            estadoAnterior: null,
            estadoNuevo: proceso.estado,
            registradoPorId: params.psicologaId,
          },
        });
        const cita = await tx.citaPsicologica.create({
          data: {
            atencionId: proceso.id,
            fechaHora: params.fechaHora,
            duracionMinutos: params.duracionMinutos,
            tipo: 'PRIMERA_ATENCION',
            ninoId: params.ninoId,
            atendidoPorId: params.psicologaId,
          },
          select: { id: true },
        });

        return {
          procesoId: proceso.id,
          consecutivo: proceso.consecutivo,
          citaId: cita.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cerrar(params: CerrarProcesoParams): Promise<ProcesoCerrado | null> {
    return this.prisma.$transaction(async (tx) => {
      const anterior = await tx.atencionPsicologica.findUnique({
        where: { id: params.procesoId },
        select: { estado: true },
      });
      const ahora = new Date();

      // La versión y el estado van en el WHERE: si otra pestaña ya cambió el proceso, esta
      // sentencia no afecta ninguna fila y no se cancela ni registra nada.
      const cerrados = await tx.atencionPsicologica.updateMany({
        where: {
          id: params.procesoId,
          version: params.version,
          estado: { not: 'CIERRE' },
        },
        data: {
          estado: 'CIERRE',
          fechaCierre: ahora,
          motivoCierreCatalogo: params.motivo,
          resumenCierre: params.resumen,
          actualizadoPorId: params.cerradoPorId,
          version: { increment: 1 },
        },
      });
      if (cerrados.count === 0 || !anterior) {
        return null;
      }

      const canceladas = await tx.citaPsicologica.updateMany({
        where: {
          atencionId: params.procesoId,
          estado: 'PROGRAMADA',
          fechaHora: { gte: ahora },
        },
        data: { estado: 'CANCELADA' },
      });
      // Sin el texto del resumen: el hito solo marca la transición; el motivo vive en el proceso.
      await tx.cambioEstadoAtencion.create({
        data: {
          atencionId: params.procesoId,
          estadoAnterior: anterior.estado,
          estadoNuevo: 'CIERRE',
          registradoPorId: params.cerradoPorId,
        },
      });

      return {
        version: params.version + 1,
        citasCanceladas: canceladas.count,
      };
    });
  }

  async actualizarVisibilidad(
    params: ActualizarVisibilidadParams,
  ): Promise<number | null> {
    const actualizados = await this.prisma.atencionPsicologica.updateMany({
      where: { id: params.procesoId, version: params.version },
      data: {
        visibleJuridico: params.visibleJuridico,
        visibleMedica: params.visibleMedica,
        actualizadoPorId: params.actualizadoPorId,
        version: { increment: 1 },
      },
    });
    return actualizados.count === 1 ? params.version + 1 : null;
  }
}
