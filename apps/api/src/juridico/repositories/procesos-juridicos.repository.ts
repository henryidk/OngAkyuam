import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fechaColumnaISO } from '@akyuam/shared';
import type { ProcesoResumen, ProcesosPaginados } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccesoProceso,
  ActualizarAsignacionParams,
  CerrarProcesoParams,
  CrearProcesoParams,
  ExpedienteAccesoJuridico,
  IProcesosJuridicosRepository,
  ListarGlobalParams,
  RegistrarAbandonoParams,
} from '../interfaces/procesos-juridicos-repository.interface';

const INCLUDE_RESUMEN = {
  abogada: true,
  procuradora: true,
  abandono: true,
} satisfies Prisma.ProcesoJuridicoInclude;

type ProcesoConRelaciones = Prisma.ProcesoJuridicoGetPayload<{
  include: typeof INCLUDE_RESUMEN;
}>;

function esViolacionDeClaveForanea(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

function mapearResumen(proceso: ProcesoConRelaciones): ProcesoResumen {
  return {
    id: proceso.id,
    expedienteId: proceso.expedienteId,
    tipo: proceso.tipo,
    estado: proceso.estado,
    abogada: proceso.abogada
      ? { id: proceso.abogada.id, nombre: proceso.abogada.nombre }
      : null,
    procuradora: proceso.procuradora
      ? { id: proceso.procuradora.id, nombre: proceso.procuradora.nombre }
      : null,
    fechaInicio: fechaColumnaISO(proceso.fechaInicio),
    fechaCierre: proceso.fechaCierre
      ? fechaColumnaISO(proceso.fechaCierre)
      : null,
    abandono: proceso.abandono
      ? {
          fecha: fechaColumnaISO(proceso.abandono.fecha),
          motivo: proceso.abandono.motivo,
        }
      : null,
  };
}

@Injectable()
export class ProcesosJuridicosRepository implements IProcesosJuridicosRepository {
  private static readonly PAGE_SIZE = 20;

  constructor(private readonly prisma: PrismaService) {}

  async buscarExpedienteConAcceso(
    expedienteId: string,
  ): Promise<ExpedienteAccesoJuridico | null> {
    return this.prisma.expediente.findFirst({
      where: { id: expedienteId, referidos: { some: { area: 'JURIDICO' } } },
      select: { id: true },
    });
  }

  async listarPorExpediente(expedienteId: string): Promise<ProcesoResumen[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      include: INCLUDE_RESUMEN,
      orderBy: { createdAt: 'desc' },
    });
    return procesos.map(mapearResumen);
  }

  async crear(params: CrearProcesoParams): Promise<{ id: string } | null> {
    try {
      return await this.prisma.procesoJuridico.create({
        data: {
          expedienteId: params.expedienteId,
          tipo: params.tipo,
          abogadaId: params.abogadaId,
          procuradoraId: params.procuradoraId,
          fechaInicio: new Date(params.fechaInicio),
          creadoPorId: params.creadoPorId,
        },
        select: { id: true },
      });
    } catch (error) {
      if (esViolacionDeClaveForanea(error)) {
        return null;
      }
      throw error;
    }
  }

  async buscarAccesoProceso(procesoId: string): Promise<AccesoProceso | null> {
    return this.prisma.procesoJuridico.findFirst({
      where: {
        id: procesoId,
        expediente: { referidos: { some: { area: 'JURIDICO' } } },
      },
      select: { id: true, expedienteId: true },
    });
  }

  async obtenerDetalle(procesoId: string): Promise<ProcesoResumen | null> {
    const proceso = await this.prisma.procesoJuridico.findUnique({
      where: { id: procesoId },
      include: INCLUDE_RESUMEN,
    });
    return proceso ? mapearResumen(proceso) : null;
  }

  async actualizarAsignacion(
    params: ActualizarAsignacionParams,
  ): Promise<boolean> {
    try {
      await this.prisma.procesoJuridico.update({
        where: { id: params.procesoId },
        data: {
          abogadaId: params.abogadaId,
          procuradoraId: params.procuradoraId,
        },
      });
      return true;
    } catch (error) {
      if (esViolacionDeClaveForanea(error)) {
        return false;
      }
      throw error;
    }
  }

  async cerrar(params: CerrarProcesoParams): Promise<void> {
    await this.prisma.procesoJuridico.update({
      where: { id: params.procesoId },
      data: { estado: 'CERRADO', fechaCierre: new Date(params.fechaCierre) },
    });
  }

  async registrarAbandono(params: RegistrarAbandonoParams): Promise<void> {
    await this.prisma.abandonoProceso.create({
      data: {
        procesoId: params.procesoId,
        fecha: new Date(params.fecha),
        motivo: params.motivo,
        registradoPorId: params.registradoPorId,
      },
    });
  }

  async listarGlobalPaginado(
    params: ListarGlobalParams,
  ): Promise<ProcesosPaginados> {
    const pageSize = ProcesosJuridicosRepository.PAGE_SIZE;
    const filtroEstado: Prisma.ProcesoJuridicoWhereInput =
      params.estado === 'EN_CURSO'
        ? { estado: 'INICIADO', abandono: { is: null } }
        : { OR: [{ estado: 'CERRADO' }, { abandono: { isNot: null } }] };

    // Defensa en profundidad: aunque hoy todo ProcesoJuridico nace de un expediente ya
    // referido a JURIDICO, esta vista global vuelve a filtrar por el referido vigente en
    // vez de asumir que el acceso otorgado al crearlo sigue siendo válido.
    const where: Prisma.ProcesoJuridicoWhereInput = {
      ...filtroEstado,
      expediente: { referidos: { some: { area: 'JURIDICO' } } },
    };

    const [procesos, total] = await Promise.all([
      this.prisma.procesoJuridico.findMany({
        where,
        include: {
          ...INCLUDE_RESUMEN,
          expediente: { include: { usuaria: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.procesoJuridico.count({ where }),
    ]);

    return {
      items: procesos.map((proceso) => ({
        ...mapearResumen(proceso),
        expedienteNumero: proceso.expediente.numero,
        usuariaNombreCompleto: `${proceso.expediente.usuaria.nombres} ${proceso.expediente.usuaria.apellidos}`,
      })),
      page: params.page,
      pageSize,
      total,
    };
  }
}
