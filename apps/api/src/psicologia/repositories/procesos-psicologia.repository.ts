import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OtroProcesoActivoError,
  ProcesoNoDisponibleError,
  ProcesoYaAbiertoError,
  ReferenciaPendienteError,
} from '../interfaces/procesos-psicologia-repository.interface';
import type {
  AbrirProcesoNuevoParams,
  AbrirProcesoParams,
  AccesoProcesoPsicologia,
  AccesoUsuariaPsicologia,
  ActualizarVisibilidadParams,
  CerrarProcesoParams,
  IProcesosPsicologiaRepository,
  ProcesoAbierto,
  ProcesoCerrado,
} from '../interfaces/procesos-psicologia-repository.interface';
import {
  EXPEDIENTE_SIN_TOMAR,
  expedienteAccesible,
  expedienteConProcesoDe,
} from './acceso-expediente';

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

  async buscarAccesoUsuaria(
    usuariaId: string,
    psicologaId: string,
  ): Promise<AccesoUsuariaPsicologia | null> {
    const usuaria = await this.prisma.usuaria.findFirst({
      where: {
        id: usuariaId,
        expedientes: { some: expedienteAccesible(psicologaId) },
      },
      select: {
        id: true,
        expedientes: {
          where: expedienteConProcesoDe(psicologaId),
          select: { id: true, numero: true },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });
    if (!usuaria) {
      return null;
    }
    return {
      usuariaId: usuaria.id,
      expediente: usuaria.expedientes[0] ?? null,
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

  async abrirNuevo(params: AbrirProcesoNuevoParams): Promise<ProcesoAbierto> {
    for (let intento = 1; ; intento += 1) {
      try {
        return await this.abrirNuevoEnTransaccion(params);
      } catch (error) {
        if (intento >= INTENTOS_MAXIMOS || !esReintentable(error)) {
          throw error;
        }
      }
    }
  }

  private abrirNuevoEnTransaccion(
    params: AbrirProcesoNuevoParams,
  ): Promise<ProcesoAbierto> {
    return this.prisma.$transaction(
      async (tx) => {
        const expediente = await tx.expediente.findFirst({
          where: {
            id: params.expedienteId,
            usuariaId: params.usuariaId,
            ...expedienteConProcesoDe(params.psicologaId),
          },
          select: { id: true },
        });
        if (!expediente) {
          throw new ProcesoNoDisponibleError();
        }

        // Cualquier atención sin cerrar de la usuaria, de cualquier psicóloga y en cualquier
        // expediente. Sin fecha de inicio es un caso tomado que espera su primera cita.
        const sinCerrar = await tx.atencionPsicologica.findFirst({
          where: {
            estado: { not: 'CIERRE' },
            expediente: { usuariaId: params.usuariaId },
          },
          select: { fechaInicio: true },
          orderBy: { fechaInicio: { sort: 'desc', nulls: 'last' } },
        });
        if (sinCerrar) {
          throw sinCerrar.fechaInicio
            ? new OtroProcesoActivoError()
            : new ReferenciaPendienteError();
        }
        const referenciaSinTomar = await tx.referidoArea.findFirst({
          where: {
            area: 'PSICOLOGIA',
            expediente: {
              usuariaId: params.usuariaId,
              ...EXPEDIENTE_SIN_TOMAR,
            },
          },
          select: { id: true },
        });
        if (referenciaSinTomar) {
          throw new ReferenciaPendienteError();
        }

        const ultimo = await tx.atencionPsicologica.aggregate({
          where: { expedienteId: expediente.id },
          _max: { consecutivo: true },
        });
        const ahora = new Date();
        const proceso = await tx.atencionPsicologica.create({
          data: {
            expedienteId: expediente.id,
            consecutivo: (ultimo._max.consecutivo ?? 0) + 1,
            estado: 'INICIO',
            psicologaAsignadaId: params.psicologaId,
            tomadaEn: ahora,
            fechaInicio: ahora,
            actualizadoPorId: params.psicologaId,
          },
          select: { id: true, consecutivo: true },
        });
        await tx.cambioEstadoAtencion.create({
          data: {
            atencionId: proceso.id,
            estadoAnterior: null,
            estadoNuevo: 'INICIO',
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
