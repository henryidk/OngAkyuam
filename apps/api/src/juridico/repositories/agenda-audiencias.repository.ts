import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  etiquetaProceso,
  horaGT,
  separarNumeroInterno,
  type AudienciaDetalleDto,
  type AudienciaFilaDto,
  type AudienciaOcupadaDto,
  type VistaAudiencias,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESO_CON_ACCESO } from '../compartido/acceso-juridico';
import { escaparLike } from '../compartido/sql';
import type {
  IAgendaAudienciasRepository,
  ListarAudienciasParams,
} from '../interfaces/agenda-audiencias-repository.interface';
import {
  INCLUDE_DETALLE_AUDIENCIA,
  INCLUDE_FILA_AUDIENCIA,
  mapearDetalleAudiencia,
  mapearFilaAudiencia,
} from './mapeo-audiencia';

type Where = Prisma.AudienciaJuridicaWhereInput;

interface DefinicionVista {
  where: (ahora: Date) => Where;
  orden: Prisma.SortOrder;
}

/**
 * Próximas y Pendientes se ordenan de la más cercana a la más lejana (lo urgente arriba; en
 * Pendientes, la que más tiempo lleva sin resultado). El Historial, de la más reciente hacia
 * atrás.
 */
const VISTAS: Record<VistaAudiencias, DefinicionVista> = {
  proximas: {
    where: (ahora) => ({ estado: 'PROGRAMADA', inicio: { gt: ahora } }),
    orden: 'asc',
  },
  pendientes: {
    where: (ahora) => ({ estado: 'PROGRAMADA', inicio: { lte: ahora } }),
    orden: 'asc',
  },
  historial: { where: () => ({}), orden: 'desc' },
};

const CON_ACCESO: Where = { proceso: PROCESO_CON_ACCESO };

/**
 * Cada palabra tiene que aparecer en el No. de expediente, el No. judicial o el nombre de la
 * usuaria: así "Ana López" encuentra a "Ana María López". `contains` va parametrizado pero
 * NO escapa `%` ni `_` (comprobado: "%" traía a todas), por eso pasa por `escaparLike`.
 */
function condicionBusqueda(q: string | undefined): Where {
  // "05-2026 · Proceso 2" no está en ninguna columna: se separa en expediente + consecutivo (H1).
  const numeroInterno = q ? separarNumeroInterno(q) : null;
  if (numeroInterno) {
    return {
      proceso: {
        consecutivo: numeroInterno.consecutivo,
        expediente: { numero: numeroInterno.expedienteNumero },
      },
    };
  }
  const palabras = q?.split(/\s+/).filter(Boolean) ?? [];
  return {
    AND: palabras.map((palabra) => {
      const contiene = {
        contains: escaparLike(palabra),
        mode: 'insensitive',
      } as const;
      return {
        proceso: {
          OR: [
            { numeroJudicial: contiene },
            { expediente: { numero: contiene } },
            {
              expediente: {
                usuaria: {
                  OR: [{ nombres: contiene }, { apellidos: contiene }],
                },
              },
            },
          ],
        },
      };
    }),
  };
}

function condicionesListado(params: ListarAudienciasParams): Where {
  return {
    AND: [
      CON_ACCESO,
      VISTAS[params.vista].where(params.ahora),
      condicionBusqueda(params.q),
      {
        inicio: { gte: params.desde, lte: params.hasta },
        estado: params.estado,
        responsableId: params.responsableId,
        ...(params.responsableUsuarioId && {
          responsable: { usuarioId: params.responsableUsuarioId },
        }),
      },
    ],
  };
}

@Injectable()
export class AgendaAudienciasRepository implements IAgendaAudienciasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    params: ListarAudienciasParams,
  ): Promise<{ items: AudienciaFilaDto[]; total: number }> {
    const where = condicionesListado(params);
    const orden = VISTAS[params.vista].orden;
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.audienciaJuridica.findMany({
        where,
        include: INCLUDE_FILA_AUDIENCIA,
        orderBy: [{ inicio: orden }, { id: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.audienciaJuridica.count({ where }),
    ]);
    return {
      items: filas.map((fila) => mapearFilaAudiencia(fila, params.ahora)),
      total,
    };
  }

  async listarOcupadas(
    responsableId: string,
    desde: Date,
    hasta: Date,
  ): Promise<AudienciaOcupadaDto[]> {
    const filas = await this.prisma.audienciaJuridica.findMany({
      where: {
        ...CON_ACCESO,
        responsableId,
        estado: 'PROGRAMADA',
        inicio: { gte: desde, lte: hasta },
      },
      select: {
        id: true,
        inicio: true,
        descripcion: true,
        proceso: {
          select: {
            consecutivo: true,
            expediente: { select: { numero: true } },
          },
        },
      },
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => ({
      id: fila.id,
      hora: horaGT(fila.inicio),
      codigoProceso: etiquetaProceso(
        fila.proceso.expediente.numero,
        fila.proceso.consecutivo,
      ),
      descripcion: fila.descripcion,
    }));
  }

  async listarPorProceso(
    procesoId: string,
    ahora: Date,
  ): Promise<AudienciaDetalleDto[]> {
    const filas = await this.prisma.audienciaJuridica.findMany({
      where: { ...CON_ACCESO, procesoId },
      include: INCLUDE_DETALLE_AUDIENCIA,
      orderBy: [{ inicio: 'desc' }, { id: 'asc' }],
    });
    return filas.map((fila) => mapearDetalleAudiencia(fila, ahora));
  }
}
