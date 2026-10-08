import { Injectable } from '@nestjs/common';
import { Prisma, MunicipioAltaVerapaz } from '@prisma/client';
import type {
  AtencionPsicologicaDetalle,
  ExpedienteResumenBusqueda,
  ReferenciaSinTomar,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ActualizarEstadoAtencionParams,
  BuscarExpedientesParams,
  ExpedienteAccesoPsicologia,
  IAtencionPsicologicaRepository,
  ObtenerOCrearAtencionParams,
  PaginaConCursorRepo,
  ResultadoTomarCaso,
  TomarCasoParams,
} from '../interfaces/atencion-psicologica-repository.interface';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';

/** Un elemento de sobra para saber si hay siguiente página, sin un segundo `count` (§7.5 del plan). */
const LIMITE_EXTRA_CURSOR = 1;

const RESUMEN_CIERRE_SIN_MOTIVO =
  'Cerrado antes de registrar el motivo de cierre';

import { EXPEDIENTE_SIN_TOMAR } from './acceso-expediente';

export { EXPEDIENTE_SIN_TOMAR };

const INCLUDE_ATENCION = {
  actualizadoPor: { select: { nombreCompleto: true } },
  psicologaAsignada: { select: { nombreCompleto: true } },
  citas: { include: INCLUDE_CITA, orderBy: { fechaHora: 'desc' } },
  cambiosEstado: {
    include: { registradoPor: { select: { nombreCompleto: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.AtencionPsicologicaInclude;

type AtencionConRelaciones = Prisma.AtencionPsicologicaGetPayload<{
  include: typeof INCLUDE_ATENCION;
}>;

function mapearAtencion(
  atencion: AtencionConRelaciones,
): AtencionPsicologicaDetalle {
  return {
    id: atencion.id,
    expedienteId: atencion.expedienteId,
    estado: atencion.estado,
    psicologaAsignada: atencion.psicologaAsignada?.nombreCompleto ?? null,
    tomadaEn: atencion.tomadaEn?.toISOString() ?? null,
    fechaInicio: atencion.fechaInicio?.toISOString() ?? null,
    fechaCierre: atencion.fechaCierre?.toISOString() ?? null,
    motivoCierre: atencion.motivoCierre,
    actualizadoPor: atencion.actualizadoPor.nombreCompleto,
    actualizadoEn: atencion.updatedAt.toISOString(),
    citas: atencion.citas.map(mapearCita),
    historialEstados: atencion.cambiosEstado.map((cambio) => ({
      id: cambio.id,
      estadoAnterior: cambio.estadoAnterior,
      estadoNuevo: cambio.estadoNuevo,
      motivo: cambio.motivo,
      registradoPor: cambio.registradoPor.nombreCompleto,
      createdAt: cambio.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class AtencionPsicologicaRepository implements IAtencionPsicologicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpedienteConAcceso(
    expedienteId: string,
    psicologaId: string,
  ): Promise<ExpedienteAccesoPsicologia | null> {
    return this.prisma.expediente.findFirst({
      where: {
        id: expedienteId,
        referidos: { some: { area: 'PSICOLOGIA' } },
        atencionesPsicologicas: { some: { psicologaAsignadaId: psicologaId } },
      },
      select: { id: true },
    });
  }

  async obtenerOCrear(
    params: ObtenerOCrearAtencionParams,
  ): Promise<AtencionPsicologicaDetalle> {
    const existente = await this.prisma.atencionPsicologica.findFirst({
      where: this.filtroProcesoVigente(params.expedienteId, params.creadaPorId),
      orderBy: { consecutivo: 'desc' },
      include: INCLUDE_ATENCION,
    });
    if (existente) {
      return mapearAtencion(existente);
    }
    const atencion = await this.prisma.atencionPsicologica.create({
      data: {
        expedienteId: params.expedienteId,
        consecutivo: await this.siguienteConsecutivo(params.expedienteId),
        actualizadoPorId: params.creadaPorId,
      },
      include: INCLUDE_ATENCION,
    });
    return mapearAtencion(atencion);
  }

  async actualizarEstado(
    params: ActualizarEstadoAtencionParams,
  ): Promise<AtencionPsicologicaDetalle> {
    const actual = await this.prisma.atencionPsicologica.findFirst({
      where: this.filtroProcesoVigente(
        params.expedienteId,
        params.actualizadoPorId,
      ),
      orderBy: { consecutivo: 'desc' },
      select: { id: true, estado: true, fechaInicio: true },
    });

    // Datos comunes a create/update — se calculan una vez para no repetir la condición
    // "estado entrante" entre las dos ramas del upsert.
    const entraSeguimiento =
      params.estado === 'SEGUIMIENTO' && actual?.estado !== 'SEGUIMIENTO';
    const entraCierre = params.estado === 'CIERRE';
    const datosTransicion = {
      estado: params.estado,
      actualizadoPorId: params.actualizadoPorId,
      // `fechaInicio` se fija una sola vez, la primera vez que se entra a SEGUIMIENTO — una
      // reapertura posterior no la reinicia (§6.1 del plan).
      ...(entraSeguimiento && !actual?.fechaInicio
        ? { fechaInicio: new Date() }
        : {}),
      // La base exige motivo de catálogo en todo cierre; este camino antiguo solo trae texto
      // libre, así que se guarda como "Otro" con ese texto de resumen.
      ...(entraCierre
        ? {
            fechaCierre: new Date(),
            motivoCierre: params.motivo,
            motivoCierreCatalogo: 'OTRO' as const,
            resumenCierre: params.motivo ?? RESUMEN_CIERRE_SIN_MOTIVO,
          }
        : {}),
      version: { increment: 1 },
    };

    const atencion = actual
      ? await this.prisma.atencionPsicologica.update({
          where: { id: actual.id },
          data: datosTransicion,
          include: INCLUDE_ATENCION,
        })
      : await this.prisma.atencionPsicologica.create({
          data: {
            expedienteId: params.expedienteId,
            consecutivo: await this.siguienteConsecutivo(params.expedienteId),
            ...datosTransicion,
            version: 1,
          },
          include: INCLUDE_ATENCION,
        });

    await this.prisma.cambioEstadoAtencion.create({
      data: {
        atencionId: atencion.id,
        estadoAnterior: actual?.estado ?? null,
        estadoNuevo: params.estado,
        motivo: params.motivo,
        registradoPorId: params.actualizadoPorId,
      },
    });

    // Recarga con el hito recién creado incluido, para que el detalle devuelto ya refleje el
    // historial completo sin que el llamador tenga que pedirlo por separado.
    const atencionActualizada =
      await this.prisma.atencionPsicologica.findUniqueOrThrow({
        where: { id: atencion.id },
        include: INCLUDE_ATENCION,
      });
    return mapearAtencion(atencionActualizada);
  }

  async existeReferidoPsicologia(expedienteId: string): Promise<boolean> {
    const referido = await this.prisma.referidoArea.findUnique({
      where: { expedienteId_area: { expedienteId, area: 'PSICOLOGIA' } },
      select: { expedienteId: true },
    });
    return referido !== null;
  }

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

  async listarReferenciasSinTomar(): Promise<ReferenciaSinTomar[]> {
    const referidos = await this.prisma.referidoArea.findMany({
      where: {
        area: 'PSICOLOGIA',
        expediente: EXPEDIENTE_SIN_TOMAR,
      },
      select: {
        createdAt: true,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: { select: { nombres: true, apellidos: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return referidos.map((referido) => ({
      expedienteId: referido.expediente.id,
      numero: referido.expediente.numero,
      usuariaNombreCompleto: `${referido.expediente.usuaria.nombres} ${referido.expediente.usuaria.apellidos}`,
      fechaReferido: referido.createdAt.toISOString(),
    }));
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

  async listarProcesosSinProximaCita(psicologaId: string) {
    const atenciones = await this.prisma.atencionPsicologica.findMany({
      where: {
        psicologaAsignadaId: psicologaId,
        estado: { not: 'CIERRE' },
        citas: {
          none: { estado: 'PROGRAMADA', fechaHora: { gte: new Date() } },
        },
      },
      select: {
        expedienteId: true,
        estado: true,
        expediente: {
          select: {
            numero: true,
            usuaria: { select: { nombres: true, apellidos: true } },
          },
        },
        citas: {
          select: { fechaHora: true },
          orderBy: { fechaHora: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return atenciones.map((atencion) => ({
      expedienteId: atencion.expedienteId,
      numero: atencion.expediente.numero,
      usuariaNombreCompleto: `${atencion.expediente.usuaria.nombres} ${atencion.expediente.usuaria.apellidos}`,
      estado: atencion.estado,
      ultimaCitaFechaHora: atencion.citas[0]?.fechaHora.toISOString() ?? null,
    }));
  }

  async listarCerradosDesde(psicologaId: string, desde: Date) {
    const atenciones = await this.prisma.atencionPsicologica.findMany({
      where: {
        psicologaAsignadaId: psicologaId,
        estado: 'CIERRE',
        fechaCierre: { gte: desde },
      },
      select: {
        expedienteId: true,
        fechaCierre: true,
        motivoCierre: true,
        expediente: {
          select: {
            numero: true,
            usuaria: { select: { nombres: true, apellidos: true } },
          },
        },
      },
      orderBy: { fechaCierre: 'desc' },
    });

    return atenciones.map((atencion) => ({
      expedienteId: atencion.expedienteId,
      numero: atencion.expediente.numero,
      usuariaNombreCompleto: `${atencion.expediente.usuaria.nombres} ${atencion.expediente.usuaria.apellidos}`,
      // No-null: el `where` ya exige `estado: 'CIERRE'`, que siempre fija `fechaCierre` (ver `actualizarEstado`).
      fechaCierre: atencion.fechaCierre!.toISOString(),
      motivoCierre: atencion.motivoCierre,
    }));
  }

  async buscarExpedientes(
    params: BuscarExpedientesParams,
  ): Promise<PaginaConCursorRepo<ExpedienteResumenBusqueda>> {
    const atenciones = await this.prisma.atencionPsicologica.findMany({
      where: {
        psicologaAsignadaId: params.psicologaId,
        estado: params.estado,
        expediente: {
          usuaria: params.municipio
            ? { municipio: params.municipio as MunicipioAltaVerapaz }
            : undefined,
          OR: params.q
            ? [
                { numero: { contains: params.q, mode: 'insensitive' } },
                {
                  usuaria: {
                    OR: [
                      { nombres: { contains: params.q, mode: 'insensitive' } },
                      {
                        apellidos: { contains: params.q, mode: 'insensitive' },
                      },
                    ],
                  },
                },
              ]
            : undefined,
        },
      },
      select: {
        id: true,
        expedienteId: true,
        estado: true,
        expediente: {
          select: {
            numero: true,
            usuaria: {
              select: { nombres: true, apellidos: true, municipio: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: params.limite + LIMITE_EXTRA_CURSOR,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hayMas = atenciones.length > params.limite;
    const pagina = hayMas ? atenciones.slice(0, params.limite) : atenciones;

    return {
      items: pagina.map((atencion) => ({
        expedienteId: atencion.expedienteId,
        numero: atencion.expediente.numero,
        usuariaNombreCompleto: `${atencion.expediente.usuaria.nombres} ${atencion.expediente.usuaria.apellidos}`,
        estado: atencion.estado,
        municipio: atencion.expediente.usuaria.municipio,
      })),
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  async obtenerResumenExpediente(expedienteId: string, psicologaId: string) {
    const atencion = await this.prisma.atencionPsicologica.findFirst({
      where: this.filtroProcesoVigente(expedienteId, psicologaId),
      orderBy: { consecutivo: 'desc' },
      include: INCLUDE_ATENCION,
    });
    if (!atencion) return null;

    const [totalCitas, proximaCitaCruda] = await Promise.all([
      this.prisma.citaPsicologica.count({
        where: { atencionId: atencion.id },
      }),
      this.prisma.citaPsicologica.findFirst({
        where: {
          atencionId: atencion.id,
          estado: 'PROGRAMADA',
          fechaHora: { gte: new Date() },
        },
        include: INCLUDE_CITA,
        orderBy: { fechaHora: 'asc' },
      }),
    ]);

    const expediente = await this.prisma.expediente.findUniqueOrThrow({
      where: { id: expedienteId },
      select: {
        numero: true,
        usuaria: { select: { nombres: true, apellidos: true } },
      },
    });

    const proximaCita = proximaCitaCruda
      ? {
          ...mapearCita(proximaCitaCruda),
          expedienteId,
          usuariaNombreCompleto: `${expediente.usuaria.nombres} ${expediente.usuaria.apellidos}`,
        }
      : null;

    return {
      expedienteId,
      numero: expediente.numero,
      usuariaNombreCompleto: `${expediente.usuaria.nombres} ${expediente.usuaria.apellidos}`,
      estado: atencion.estado,
      psicologaAsignada: atencion.psicologaAsignada?.nombreCompleto ?? null,
      tomadaEn: atencion.tomadaEn?.toISOString() ?? null,
      fechaInicio: atencion.fechaInicio?.toISOString() ?? null,
      fechaCierre: atencion.fechaCierre?.toISOString() ?? null,
      motivoCierre: atencion.motivoCierre,
      historialEstados: atencion.cambiosEstado.map((cambio) => ({
        id: cambio.id,
        estadoAnterior: cambio.estadoAnterior,
        estadoNuevo: cambio.estadoNuevo,
        motivo: cambio.motivo,
        registradoPor: cambio.registradoPor.nombreCompleto,
        createdAt: cambio.createdAt.toISOString(),
      })),
      totalCitas,
      proximaCita,
    };
  }

  /**
   * Los endpoints antiguos reciben un expediente y no un proceso: trabajan sobre el proceso más
   * reciente de esa psicóloga en el expediente. El filtro por dueña es obligatorio — sin él,
   * quien atendió el P1 podría leer el P2 que lleva otra psicóloga.
   */
  private filtroProcesoVigente(
    expedienteId: string,
    psicologaId: string,
  ): Prisma.AtencionPsicologicaWhereInput {
    return { expedienteId, psicologaAsignadaId: psicologaId };
  }

  private async siguienteConsecutivo(expedienteId: string): Promise<number> {
    const { _max } = await this.prisma.atencionPsicologica.aggregate({
      where: { expedienteId },
      _max: { consecutivo: true },
    });
    return (_max.consecutivo ?? 0) + 1;
  }
}
