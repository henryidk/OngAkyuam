import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FILTROS_PROCESOS_PSICOLOGIA,
  MAX_CITAS_SIN_REGISTRAR_EN_DETALLE,
  type CitaRefDto,
  type FiltroProcesosPsicologia,
  type PersonaAtendidaDto,
  type ProcesoColegaPsicologiaResumen,
  type ProcesoPsicologiaResumen,
  type ResumenProcesosPsicologia,
  type SesionProcesoDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoProceso } from '../dominio/codigo-proceso';
import { citaSinRegistrar, estaCerrado } from '../dominio/etapa-proceso';
import type { PaginaConCursorRepo } from '../interfaces/atencion-psicologica-repository.interface';
import type {
  DetalleProcesoRepo,
  IConsultasProcesosRepository,
  ListarProcesosParams,
  ListarSesionesParams,
} from '../interfaces/consultas-procesos-repository.interface';
import {
  EXPEDIENTE_SIN_TOMAR,
  PROCESO_POR_REASIGNAR,
  procesoCerradoDeColega,
  procesoLegible,
} from './acceso-expediente';
import { casoPorAgendar } from './bandeja-psicologia.repository';
import { mapearDocumentoCita } from './citas-psicologicas.mapper';
import { nombreCompleto, personaAtendida, SELECT_PERSONA } from './personas';

const LIMITE_EXTRA_CURSOR = 1;
/** Tope de procesos de una misma usuaria con una misma psicóloga: en la práctica son uno o dos. */
const LIMITE_PROCESOS_POR_USUARIA = 50;
/** Citas que empezaron pero aún no terminan: se piden de más para no dejar fuera una atrasada. */
const MARGEN_CITAS_EN_CURSO = 5;

/**
 * Un caso tomado al que todavía no se le agenda la primera cita no es un proceso: vive en
 * "Casos por agendar". Aparece aquí cuando ya abrió (tiene fecha de inicio) o si se cerró.
 */
const ES_PROCESO = {
  OR: [{ fechaInicio: { not: null } }, { estado: 'CIERRE' }],
} satisfies Prisma.AtencionPsicologicaWhereInput;

function citaFutura(ahora: Date): Prisma.CitaPsicologicaWhereInput {
  return { estado: 'PROGRAMADA', fechaHora: { gte: ahora } };
}

function condicionFiltro(
  filtro: FiltroProcesosPsicologia,
): Prisma.AtencionPsicologicaWhereInput {
  switch (filtro) {
    case 'ACTIVOS':
      return { estado: { not: 'CIERRE' } };
    case 'INICIO':
      return { estado: 'INICIO' };
    case 'SEGUIMIENTO':
      return { estado: 'SEGUIMIENTO' };
    case 'SIN_PROXIMA':
      // Ninguna cita programada: ni futura ni pasada sin registrar. Con una sin registrar lo
      // pendiente es registrarla, y esa ya se cuenta aparte en "Citas sin registrar".
      return {
        estado: { not: 'CIERRE' },
        citas: { none: { estado: 'PROGRAMADA' } },
      };
    case 'CERRADOS':
      return { estado: 'CIERRE' };
  }
}

function condicionBusqueda(
  palabras: string[],
): Prisma.AtencionPsicologicaWhereInput[] {
  return palabras.map((palabra) => ({
    expediente: {
      OR: [
        { numero: { contains: palabra } },
        { usuaria: { nombres: { contains: palabra, mode: 'insensitive' } } },
        { usuaria: { apellidos: { contains: palabra, mode: 'insensitive' } } },
      ],
    },
  }));
}

// Lo que pinta una fila de la lista. Sin texto clínico: ni notas ni resumen de cierre.
const SELECT_RESUMEN = {
  id: true,
  consecutivo: true,
  estado: true,
  fechaInicio: true,
  tomadaEn: true,
  createdAt: true,
  fechaCierre: true,
  expediente: {
    select: {
      numero: true,
      usuaria: { select: { id: true, ...SELECT_PERSONA } },
    },
  },
  citas: {
    where: { estado: 'ATENDIDA' },
    orderBy: { fechaHora: 'desc' },
    take: 1,
    select: { id: true, fechaHora: true },
  },
  _count: { select: { citas: { where: { estado: 'ATENDIDA' } } } },
} satisfies Prisma.AtencionPsicologicaSelect;

type FilaResumen = Prisma.AtencionPsicologicaGetPayload<{
  select: typeof SELECT_RESUMEN;
}>;

function referenciaCita(
  cita: { id: string; fechaHora: Date } | undefined,
): CitaRefDto | null {
  return cita ? { id: cita.id, fechaHora: cita.fechaHora.toISOString() } : null;
}

function mapearResumen(
  fila: FilaResumen,
  proximas: Map<string, CitaRefDto>,
): ProcesoPsicologiaResumen {
  return {
    id: fila.id,
    codigo: codigoProceso(fila.consecutivo, fila.expediente.numero),
    usuariaId: fila.expediente.usuaria.id,
    usuariaNombreCompleto: nombreCompleto(fila.expediente.usuaria),
    expedienteNumero: fila.expediente.numero,
    etapa: fila.estado,
    sesionesAtendidas: fila._count.citas,
    ultimaSesion: referenciaCita(fila.citas[0]),
    proximaCita: proximas.get(fila.id) ?? null,
    // Un proceso cerrado antes de su primera cita no tiene fecha de inicio: vale la de la toma.
    fechaInicio: (
      fila.fechaInicio ??
      fila.tomadaEn ??
      fila.createdAt
    ).toISOString(),
    fechaCierre: fila.fechaCierre?.toISOString() ?? null,
  };
}

@Injectable()
export class ConsultasProcesosRepository implements IConsultasProcesosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    params: ListarProcesosParams,
  ): Promise<PaginaConCursorRepo<ProcesoPsicologiaResumen>> {
    const filas = await this.prisma.atencionPsicologica.findMany({
      where: {
        psicologaAsignadaId: params.psicologaId,
        AND: [
          ES_PROCESO,
          condicionFiltro(params.filtro),
          ...condicionBusqueda(params.palabras),
        ],
      },
      select: SELECT_RESUMEN,
      // `createdAt` y no `fechaInicio`: el cursor necesita una columna que nunca sea nula.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: params.limite + LIMITE_EXTRA_CURSOR,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hayMas = filas.length > params.limite;
    const pagina = hayMas ? filas.slice(0, params.limite) : filas;
    const proximas = await this.proximasCitas(
      pagina.map((fila) => fila.id),
      params.ahora,
    );

    return {
      items: pagina.map((fila) => mapearResumen(fila, proximas)),
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  async listarDeUsuaria(
    usuariaId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<ProcesoPsicologiaResumen[]> {
    const filas = await this.prisma.atencionPsicologica.findMany({
      where: {
        psicologaAsignadaId: psicologaId,
        expediente: { usuariaId },
        ...ES_PROCESO,
      },
      select: SELECT_RESUMEN,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: LIMITE_PROCESOS_POR_USUARIA,
    });
    const proximas = await this.proximasCitas(
      filas.map((fila) => fila.id),
      ahora,
    );
    return filas.map((fila) => mapearResumen(fila, proximas));
  }

  async listarDeColegas(
    usuariaId: string,
    psicologaId: string,
  ): Promise<ProcesoColegaPsicologiaResumen[]> {
    const filas = await this.prisma.atencionPsicologica.findMany({
      where: {
        AND: [
          { expediente: { usuariaId } },
          procesoCerradoDeColega(psicologaId),
        ],
      },
      select: {
        ...SELECT_RESUMEN,
        psicologaAsignada: { select: { nombreCompleto: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: LIMITE_PROCESOS_POR_USUARIA,
    });
    // Un proceso cerrado no tiene próxima cita: al cerrarlo se cancelan las que quedaban.
    const sinProximas = new Map<string, CitaRefDto>();
    return filas.map((fila) => ({
      ...mapearResumen(fila, sinProximas),
      psicologa: fila.psicologaAsignada?.nombreCompleto ?? '',
    }));
  }

  async resumen(
    psicologaId: string,
    ahora: Date,
  ): Promise<ResumenProcesosPsicologia> {
    // Cada tarjeta cuenta con la misma condición que usa la lista al filtrar: el número de la
    // tarjeta y las filas que se ven al abrirla no pueden discrepar.
    const contar = (filtro: FiltroProcesosPsicologia) =>
      this.prisma.atencionPsicologica.count({
        where: {
          psicologaAsignadaId: psicologaId,
          AND: [ES_PROCESO, condicionFiltro(filtro)],
        },
      });

    const [
      porFiltro,
      referenciasSinTomar,
      casosPorReasignar,
      casosPorAgendar,
      [{ total: citasSinRegistrar }],
    ] = await Promise.all([
      Promise.all(FILTROS_PROCESOS_PSICOLOGIA.map(contar)),
      this.prisma.referidoArea.count({
        where: { area: 'PSICOLOGIA', expediente: EXPEDIENTE_SIN_TOMAR },
      }),
      this.prisma.atencionPsicologica.count({ where: PROCESO_POR_REASIGNAR }),
      this.prisma.atencionPsicologica.count({
        where: casoPorAgendar(psicologaId),
      }),
      // La hora de fin depende de la duración de cada cita: eso solo se puede comparar en SQL.
      this.prisma.$queryRaw<[{ total: number }]>(Prisma.sql`
        SELECT count(*)::int AS total
        FROM "CitaPsicologica" c
        JOIN "AtencionPsicologica" a ON a.id = c."atencionId"
        WHERE a."psicologaAsignadaId" = ${psicologaId}
          AND a.estado <> 'CIERRE'
          AND c.estado = 'PROGRAMADA'
          AND c."fechaHora" + c."duracionMinutos" * interval '1 minute' <= ${ahora}
      `),
    ]);

    const procesos = Object.fromEntries(
      FILTROS_PROCESOS_PSICOLOGIA.map((filtro, i) => [filtro, porFiltro[i]]),
    ) as Record<FiltroProcesosPsicologia, number>;
    return {
      procesos,
      referenciasSinTomar,
      casosPorReasignar,
      casosPorAgendar,
      citasSinRegistrar,
    };
  }

  async obtenerDetalle(
    procesoId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<DetalleProcesoRepo | null> {
    const proceso = await this.prisma.atencionPsicologica.findFirst({
      where: { id: procesoId, ...procesoLegible(psicologaId) },
      select: {
        ...SELECT_RESUMEN,
        psicologaAsignadaId: true,
        expedienteId: true,
        version: true,
        motivoCierreCatalogo: true,
        resumenCierre: true,
        visibleJuridico: true,
        visibleMedica: true,
        psicologaAsignada: { select: { nombreCompleto: true } },
        referido: { select: { motivo: true } },
        reasignaciones: {
          select: {
            createdAt: true,
            dePsicologa: { select: { nombreCompleto: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!proceso) {
      return null;
    }

    const soloLectura = proceso.psicologaAsignadaId !== psicologaId;
    const [proximas, personasAtendidas, citasSinRegistrar] = await Promise.all([
      this.proximasCitas([proceso.id], ahora),
      this.personasAtendidas(proceso.id, proceso.expediente.usuaria),
      // Solo donde todavía se puede registrar: ni en un proceso cerrado ni en el de una colega.
      soloLectura || estaCerrado(proceso.estado)
        ? []
        : this.citasSinRegistrar(proceso.id, ahora),
    ]);

    return {
      ...mapearResumen(proceso, proximas),
      expedienteId: proceso.expedienteId,
      version: proceso.version,
      psicologa: proceso.psicologaAsignada?.nombreCompleto ?? '',
      soloLectura,
      psicologasAnteriores: proceso.reasignaciones.map((reasignacion) => ({
        nombre: reasignacion.dePsicologa.nombreCompleto,
        hasta: reasignacion.createdAt.toISOString(),
      })),
      motivoReferencia: proceso.referido?.motivo ?? null,
      motivoCierre: proceso.motivoCierreCatalogo,
      resumenCierre: proceso.resumenCierre,
      personasAtendidas,
      citasSinRegistrar,
      visibilidad: {
        visibleJuridico: proceso.visibleJuridico,
        visibleMedica: proceso.visibleMedica,
      },
    };
  }

  /** Citas del proceso que ya terminaron y siguen programadas, de la más antigua a la más reciente. */
  private async citasSinRegistrar(
    procesoId: string,
    ahora: Date,
  ): Promise<CitaRefDto[]> {
    const yaEmpezadas = await this.prisma.citaPsicologica.findMany({
      where: {
        atencionId: procesoId,
        estado: 'PROGRAMADA',
        fechaHora: { lte: ahora },
      },
      select: {
        id: true,
        fechaHora: true,
        duracionMinutos: true,
        estado: true,
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
      take: MAX_CITAS_SIN_REGISTRAR_EN_DETALLE + MARGEN_CITAS_EN_CURSO,
    });
    // Que ya terminó depende de la duración de cada cita: lo decide la regla del dominio.
    return yaEmpezadas
      .filter((cita) => citaSinRegistrar(cita, ahora))
      .slice(0, MAX_CITAS_SIN_REGISTRAR_EN_DETALLE)
      .map((cita) => ({
        id: cita.id,
        fechaHora: cita.fechaHora.toISOString(),
      }));
  }

  async listarSesiones(
    params: ListarSesionesParams,
  ): Promise<PaginaConCursorRepo<SesionProcesoDto>> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        atencionId: params.procesoId,
        estado: { in: ['ATENDIDA', 'NO_ASISTIO'] },
      },
      select: {
        id: true,
        fechaHora: true,
        duracionMinutos: true,
        estado: true,
        temas: true,
        intervencion: true,
        recomendaciones: true,
        acuerdos: true,
        observaciones: true,
        motivoNoAsistencia: true,
        nino: { select: { id: true, ...SELECT_PERSONA } },
        atencion: {
          select: {
            expediente: { select: { usuaria: { select: SELECT_PERSONA } } },
          },
        },
        documentos: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      take: params.limite + LIMITE_EXTRA_CURSOR,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hayMas = citas.length > params.limite;
    const pagina = hayMas ? citas.slice(0, params.limite) : citas;

    // "Sesión 3" = la tercera atendida del proceso en orden cronológico. Se cuentan las que
    // quedan antes de la más antigua de esta página y de ahí se numera hacia arriba.
    const atendidas = pagina.filter((cita) => cita.estado === 'ATENDIDA');
    const masAntigua = atendidas[atendidas.length - 1];
    const anteriores = masAntigua
      ? await this.prisma.citaPsicologica.count({
          where: {
            atencionId: params.procesoId,
            estado: 'ATENDIDA',
            OR: [
              { fechaHora: { lt: masAntigua.fechaHora } },
              { fechaHora: masAntigua.fechaHora, id: { lt: masAntigua.id } },
            ],
          },
        })
      : 0;
    const numeros = new Map(
      atendidas.map((cita, i) => [cita.id, anteriores + atendidas.length - i]),
    );

    return {
      items: pagina.map((cita) => ({
        citaId: cita.id,
        numero: numeros.get(cita.id) ?? null,
        fechaHora: cita.fechaHora.toISOString(),
        duracionMinutos: cita.duracionMinutos,
        estado: cita.estado,
        persona: personaAtendida(cita.atencion.expediente.usuaria, cita.nino),
        temas: cita.temas,
        intervencion: cita.intervencion,
        recomendaciones: cita.recomendaciones,
        acuerdos: cita.acuerdos,
        observaciones: cita.observaciones,
        motivoNoAsistencia: cita.motivoNoAsistencia,
        documento: mapearDocumentoCita(cita.documentos[0]),
      })),
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  /** La cita programada más cercana de cada proceso, en una sola consulta para toda la página. */
  private async proximasCitas(
    procesoIds: string[],
    ahora: Date,
  ): Promise<Map<string, CitaRefDto>> {
    if (procesoIds.length === 0) {
      return new Map();
    }
    const citas = await this.prisma.citaPsicologica.findMany({
      where: { atencionId: { in: procesoIds }, ...citaFutura(ahora) },
      select: { id: true, atencionId: true, fechaHora: true },
      orderBy: { fechaHora: 'asc' },
      distinct: ['atencionId'],
    });
    return new Map(
      citas.map((cita) => [
        cita.atencionId,
        { id: cita.id, fechaHora: cita.fechaHora.toISOString() },
      ]),
    );
  }

  /** A quiénes se ha atendido en el proceso: la usuaria y/o sus hijos/as, sin repetir. */
  private async personasAtendidas(
    procesoId: string,
    usuaria: { nombres: string; apellidos: string; fechaNacimiento: Date },
  ): Promise<PersonaAtendidaDto[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: { atencionId: procesoId, estado: 'ATENDIDA' },
      select: { nino: { select: { id: true, ...SELECT_PERSONA } } },
      distinct: ['ninoId'],
    });
    return citas
      .map((cita) => personaAtendida(usuaria, cita.nino))
      .sort((a, b) => Number(a.ninoId !== null) - Number(b.ninoId !== null));
  }
}
