import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA,
  MAX_SESIONES_POR_REGISTRAR_PSICOLOGIA,
  type DetalleConsultaPsicologiaDto,
  type EstadoHistorialConsultasPsicologia,
  type FilaHistorialConsultaPsicologiaDto,
  type SesionPorRegistrarDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginaConCursorRepo } from '../interfaces/atencion-psicologica-repository.interface';
import type {
  HistorialSesionesParams,
  IConsultasSesionesRepository,
} from '../interfaces/consultas-sesiones-repository.interface';
import { PROCESO_LEGIBLE, sesionPorRegistrar } from './acceso-expediente';
import { condicionBusqueda } from './busqueda-procesos';
import { mapearDocumentoCita } from './citas-psicologicas.mapper';
import { codigoProceso, SELECT_CODIGO_PROCESO } from './codigo-proceso';
import { nombreCompleto, personaAtendida, SELECT_PERSONA } from './personas';

const LIMITE_EXTRA_CURSOR = 1;

/** Sesiones que ya ocurrieron (o se perdieron): las únicas que entran al historial. */
const SESION_REALIZADA = {
  estado: { in: [...ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA] },
} satisfies Prisma.CitaPsicologicaWhereInput;

// Lo que identifica una sesión en una fila: proceso, persona y código. Sin texto clínico.
const SELECT_ENCABEZADO = {
  id: true,
  fechaHora: true,
  atencionId: true,
  nino: { select: { id: true, ...SELECT_PERSONA } },
  atencion: {
    select: {
      ...SELECT_CODIGO_PROCESO,
      expediente: {
        select: {
          numero: true,
          usuaria: { select: { id: true, ...SELECT_PERSONA } },
        },
      },
    },
  },
} satisfies Prisma.CitaPsicologicaSelect;

type FilaEncabezado = Prisma.CitaPsicologicaGetPayload<{
  select: typeof SELECT_ENCABEZADO;
}>;

function encabezado(fila: FilaEncabezado) {
  const { expediente } = fila.atencion;
  return {
    citaId: fila.id,
    procesoId: fila.atencionId,
    procesoCodigo: codigoProceso(expediente.numero, fila.atencion),
    usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
    persona: personaAtendida(expediente.usuaria, fila.nino),
    fechaHora: fila.fechaHora.toISOString(),
  };
}

/** Condiciones del historial, en el mismo orden en que se leen los filtros en pantalla. */
export function condicionHistorial(
  params: Omit<HistorialSesionesParams, 'cursor' | 'limite'>,
): Prisma.CitaPsicologicaWhereInput {
  return {
    AND: [
      { atencion: PROCESO_LEGIBLE },
      SESION_REALIZADA,
      { fechaHora: { gte: params.desde, lt: params.hasta } },
      params.alcance === 'MIOS' ? { atendidoPorId: params.psicologaId } : {},
      params.clinica ? { clinica: params.clinica } : {},
      params.estado ? { estado: params.estado } : {},
      ...condicionBusqueda(params.palabras).map((condicion) => ({
        atencion: condicion,
      })),
    ],
  };
}

@Injectable()
export class ConsultasSesionesRepository implements IConsultasSesionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async porRegistrar(
    psicologaId: string,
    ahora: Date,
  ): Promise<SesionPorRegistrarDto[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: sesionPorRegistrar(psicologaId, ahora),
      select: {
        ...SELECT_ENCABEZADO,
        duracionMinutos: true,
        tipo: true,
        borrador: true,
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
      take: MAX_SESIONES_POR_REGISTRAR_PSICOLOGIA,
    });
    return citas.map((cita) => ({
      ...encabezado(cita),
      duracionMinutos: cita.duracionMinutos,
      tipo: cita.tipo,
      borrador: cita.borrador,
    }));
  }

  async historial(
    params: HistorialSesionesParams,
  ): Promise<PaginaConCursorRepo<FilaHistorialConsultaPsicologiaDto>> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: condicionHistorial(params),
      select: {
        ...SELECT_ENCABEZADO,
        estado: true,
        clinica: true,
        atendidoPorId: true,
        atendidoPor: { select: { nombreCompleto: true } },
        _count: { select: { documentos: true } },
      },
      orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      take: params.limite + LIMITE_EXTRA_CURSOR,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hayMas = citas.length > params.limite;
    const pagina = hayMas ? citas.slice(0, params.limite) : citas;
    return {
      items: pagina.map((cita) => ({
        ...encabezado(cita),
        // El `where` ya dejó solo estos dos estados.
        estado: cita.estado as EstadoHistorialConsultasPsicologia,
        clinica: cita.clinica,
        atendidoPor: cita.atendidoPor.nombreCompleto,
        propia: cita.atendidoPorId === params.psicologaId,
        tieneHoja: cita._count.documentos > 0,
      })),
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  async detalle(citaId: string): Promise<DetalleConsultaPsicologiaDto | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: { id: citaId, atencion: PROCESO_LEGIBLE, ...SESION_REALIZADA },
      select: {
        ...SELECT_ENCABEZADO,
        duracionMinutos: true,
        estado: true,
        temas: true,
        intervencion: true,
        recomendaciones: true,
        acuerdos: true,
        observaciones: true,
        motivoNoAsistencia: true,
        clinica: true,
        enfoqueTerapeutico: true,
        atendidoPor: { select: { nombreCompleto: true } },
        documentos: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!cita) {
      return null;
    }

    return {
      ...encabezado(cita),
      numero:
        cita.estado === 'ATENDIDA' ? await this.numeroDeSesion(cita) : null,
      usuariaId: cita.atencion.expediente.usuaria.id,
      duracionMinutos: cita.duracionMinutos,
      estado: cita.estado,
      temas: cita.temas,
      intervencion: cita.intervencion,
      recomendaciones: cita.recomendaciones,
      acuerdos: cita.acuerdos,
      observaciones: cita.observaciones,
      motivoNoAsistencia: cita.motivoNoAsistencia,
      clinica: cita.clinica,
      enfoqueTerapeutico: cita.enfoqueTerapeutico,
      documento: mapearDocumentoCita(cita.documentos[0]),
      atendidoPor: cita.atendidoPor.nombreCompleto,
    };
  }

  /** "Sesión 3" = la tercera atendida del proceso en orden cronológico (mismo criterio que Sesiones). */
  private async numeroDeSesion(cita: {
    id: string;
    atencionId: string;
    fechaHora: Date;
  }): Promise<number> {
    const anteriores = await this.prisma.citaPsicologica.count({
      where: {
        atencionId: cita.atencionId,
        estado: 'ATENDIDA',
        OR: [
          { fechaHora: { lt: cita.fechaHora } },
          { fechaHora: cita.fechaHora, id: { lt: cita.id } },
        ],
      },
    });
    return anteriores + 1;
  }
}
