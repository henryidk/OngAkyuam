import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DURACION_CITA_MEDICA_MIN,
  ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA,
  fechaCalendarioGT,
  fechaColumnaISO,
  horaGT,
  etiquetaProceso,
  etiquetaAtencion,
} from '@akyuam/shared';
import type {
  AtencionMedicaResumenDto,
  FichaPacienteMedicaDto,
  FiltroPacientesMedica,
  PacienteBuscadaMedicaDto,
  PacientesMedicaPaginaDto,
  VistaPsicologicaParaMedicaDto,
} from '@akyuam/shared';
import { condicionBusqueda } from '../../common/busqueda-usuarias';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_PERSONA,
  edad,
  nombreCompleto,
  personasDelExpediente,
} from '../../psicologia/repositories/personas';
import {
  referenciaPendiente,
  situacionPaciente,
} from '../dominio/reglas-atencion';
import type {
  BuscarProgramablesParams,
  IPacientesMedicaRepository,
  ListarPacientesMedicaParams,
} from '../interfaces/pacientes-medica-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { horaFin } from '../dominio/horario';
import {
  SELECT_PERSONAS_CITA,
  SELECT_SIGNOS,
  personasDeCita,
  procedencia,
  signosDeFila,
} from './mapeo';

type FilaPacienteRow = {
  usuariaId: string;
  nombres: string;
  apellidos: string;
  nombreOrden: string;
  dpi: string | null;
  fechaNacimiento: Date;
  expedienteNumero: string;
  hijos: number;
  situacion: FiltroPacientesMedica;
  consultas: number;
  ultimaConsulta: Date | null;
  proximaCita: Date | null;
};

type ConteosRow = Record<FiltroPacientesMedica | 'TODAS', number>;

/** El expediente `e` tiene alguna referencia de Trabajo Social a Medicina. */
const REFERIDO_SQL = Prisma.sql`EXISTS (SELECT 1 FROM "ReferidoArea" rx WHERE rx."expedienteId" = e.id AND rx.area = 'MEDICA')`;

/**
 * La misma regla que `referenciaPendiente` del dominio: referencia a Medicina sin atención activa
 * ni atención abierta después de ella en su expediente.
 */
const REFERENCIA_PENDIENTE_SQL = Prisma.sql`
  EXISTS (
    SELECT 1 FROM "ReferidoArea" r
    JOIN "Expediente" e ON e.id = r."expedienteId"
    WHERE e."usuariaId" = u.id AND r.area = 'MEDICA'
      AND NOT EXISTS (
        SELECT 1 FROM "AtencionMedica" a
        WHERE a."expedienteId" = e.id
          AND (a.estado = 'ACTIVA' OR a."createdAt" >= r."createdAt")
      )
  )`;

const ATENCION_ACTIVA_SQL = Prisma.sql`
  EXISTS (
    SELECT 1 FROM "AtencionMedica" a
    JOIN "Expediente" e ON e.id = a."expedienteId"
    WHERE e."usuariaId" = u.id AND a.estado = 'ACTIVA' AND ${REFERIDO_SQL}
  )`;

/** Una fila por usuaria con algún expediente referido a Medicina. */
function cteLista(
  params: Pick<ListarPacientesMedicaParams, 'busqueda' | 'ahora'>,
): Prisma.Sql {
  return Prisma.sql`
    WITH lista AS (
      SELECT
        u.id AS "usuariaId",
        u.nombres,
        u.apellidos,
        (u.nombres || ' ' || u.apellidos) AS "nombreOrden",
        u.dpi,
        u."fechaNacimiento",
        ex.numero AS "expedienteNumero",
        ex.hijos,
        CASE
          WHEN ${ATENCION_ACTIVA_SQL} THEN 'EN_ATENCION'
          WHEN ${REFERENCIA_PENDIENTE_SQL} THEN 'POR_AGENDAR'
          ELSE 'DE_ALTA'
        END AS situacion,
        c.consultas,
        c.ultima AS "ultimaConsulta",
        p.proxima AS "proximaCita"
      FROM "Usuaria" u
      -- El expediente con el que trabaja Medicina: el de la atención activa o, si no, el más reciente.
      JOIN LATERAL (
        SELECT
          e.numero,
          (SELECT count(*)::int FROM "Nino" n WHERE n."expedienteId" = e.id) AS hijos
        FROM "Expediente" e
        WHERE e."usuariaId" = u.id AND ${REFERIDO_SQL}
        ORDER BY
          EXISTS (SELECT 1 FROM "AtencionMedica" a WHERE a."expedienteId" = e.id AND a.estado = 'ACTIVA') DESC,
          e.fecha DESC,
          e."createdAt" DESC
        LIMIT 1
      ) ex ON TRUE
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS consultas, max(cm."fechaHora") AS ultima
        FROM "ConsultaMedica" cm
        JOIN "AtencionMedica" a ON a.id = cm."atencionId"
        JOIN "Expediente" e ON e.id = a."expedienteId"
        WHERE e."usuariaId" = u.id AND ${REFERIDO_SQL}
      ) c
      CROSS JOIN LATERAL (
        SELECT min(ci.inicio) AS proxima
        FROM "CitaMedica" ci
        JOIN "AtencionMedica" a ON a.id = ci."atencionId"
        JOIN "Expediente" e ON e.id = a."expedienteId"
        WHERE e."usuariaId" = u.id AND ${REFERIDO_SQL}
          AND ci.estado = 'PROGRAMADA' AND ci.inicio > ${params.ahora}
      ) p
      WHERE ${condicionBusqueda(params.busqueda)}
    )
  `;
}

function codificarCursorNombre(nombre: string, id: string): string {
  return Buffer.from(JSON.stringify([nombre, id])).toString('base64url');
}

function decodificarCursorNombre(
  cursor: string | undefined,
): [string, string] | null {
  if (!cursor) {
    return null;
  }
  try {
    const valor: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString(),
    );
    if (
      Array.isArray(valor) &&
      valor.length === 2 &&
      typeof valor[0] === 'string' &&
      typeof valor[1] === 'string'
    ) {
      return [valor[0], valor[1]];
    }
  } catch {
    // Un cursor inválido se trata como la primera página.
  }
  return null;
}

const SELECT_NINOS = {
  select: { id: true, ...SELECT_PERSONA },
  orderBy: { fechaNacimiento: 'asc' },
} as const;

const SELECT_ATENCION_FICHA = {
  id: true,
  consecutivo: true,
  estado: true,
  fechaInicio: true,
  fechaAlta: true,
  motivoAlta: true,
  version: true,
  visibleJuridico: true,
  visiblePsicologia: true,
  createdAt: true,
  referido: { select: { motivo: true } },
  _count: { select: { consultas: true } },
} as const;

@Injectable()
export class PacientesMedicaRepository implements IPacientesMedicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    params: ListarPacientesMedicaParams,
  ): Promise<PacientesMedicaPaginaDto> {
    const base = cteLista(params);
    const filtro = params.estado
      ? Prisma.sql`situacion = ${params.estado}`
      : Prisma.sql`TRUE`;
    const despues = decodificarCursorNombre(params.cursor);
    const desde = despues
      ? Prisma.sql`("nombreOrden", "usuariaId") > (${despues[0]}, ${despues[1]})`
      : Prisma.sql`TRUE`;

    const [filas, [conteos]] = await Promise.all([
      this.prisma.$queryRaw<FilaPacienteRow[]>(Prisma.sql`
        ${base}
        SELECT * FROM lista
        WHERE ${filtro} AND ${desde}
        ORDER BY "nombreOrden", "usuariaId"
        LIMIT ${params.porPagina + 1}
      `),
      this.prisma.$queryRaw<ConteosRow[]>(Prisma.sql`
        ${base}
        SELECT
          count(*)::int AS "TODAS",
          count(*) FILTER (WHERE situacion = 'EN_ATENCION')::int AS "EN_ATENCION",
          count(*) FILTER (WHERE situacion = 'POR_AGENDAR')::int AS "POR_AGENDAR",
          count(*) FILTER (WHERE situacion = 'DE_ALTA')::int AS "DE_ALTA"
        FROM lista
      `),
    ]);

    const pagina = filas.slice(0, params.porPagina);
    const ultima = pagina[pagina.length - 1];
    return {
      items: pagina.map((fila) => ({
        usuariaId: fila.usuariaId,
        nombreCompleto: nombreCompleto(fila),
        dpi: fila.dpi,
        edad: edad(fila),
        hijos: fila.hijos,
        expedienteNumero: fila.expedienteNumero,
        situacion: fila.situacion,
        consultas: fila.consultas,
        ultimaConsulta: fila.ultimaConsulta
          ? fechaCalendarioGT(fila.ultimaConsulta)
          : null,
        proximaCita: fila.proximaCita
          ? {
              fecha: fechaCalendarioGT(fila.proximaCita),
              hora: horaGT(fila.proximaCita),
            }
          : null,
      })),
      siguienteCursor:
        filas.length > params.porPagina && ultima
          ? codificarCursorNombre(ultima.nombreOrden, ultima.usuariaId)
          : null,
      conteos,
    };
  }

  async buscarProgramables(
    params: BuscarProgramablesParams,
  ): Promise<PacienteBuscadaMedicaDto[]> {
    if (params.situaciones.length === 0) {
      return [];
    }
    const { busqueda } = params;
    let orden: Prisma.Sql;
    if (params.orden === 'referencia') {
      orden = Prisma.sql`"referidaEl" ASC NULLS LAST, "nombreOrden", "usuariaId"`;
    } else if (busqueda?.tipo === 'nombre') {
      orden = Prisma.sql`word_similarity(${busqueda.valor}, "nombreOrden") DESC, "nombreOrden", "usuariaId"`;
    } else {
      orden = Prisma.sql`"nombreOrden", "usuariaId"`;
    }

    const filas = await this.prisma.$queryRaw<
      (FilaPacienteRow & { referidaEl: Date | null })[]
    >(Prisma.sql`
      ${cteLista(params)}
      SELECT * FROM (
        SELECT lista.*, (
          -- La referencia pendiente más antigua de la usuaria (misma regla que REFERENCIA_PENDIENTE_SQL).
          SELECT min(r."createdAt") FROM "ReferidoArea" r
          JOIN "Expediente" e ON e.id = r."expedienteId"
          WHERE e."usuariaId" = lista."usuariaId" AND r.area = 'MEDICA'
            AND NOT EXISTS (
              SELECT 1 FROM "AtencionMedica" a
              WHERE a."expedienteId" = e.id
                AND (a.estado = 'ACTIVA' OR a."createdAt" >= r."createdAt")
            )
        ) AS "referidaEl"
        FROM lista
      ) lista
      WHERE situacion IN (${Prisma.join([...params.situaciones])})
      ORDER BY ${orden}
      LIMIT ${params.limite}
    `);

    return filas.map((fila) => ({
      usuariaId: fila.usuariaId,
      nombreCompleto: nombreCompleto(fila),
      expedienteNumero: fila.expedienteNumero,
      situacion: fila.situacion as PacienteBuscadaMedicaDto['situacion'],
      hijos: fila.hijos,
      proximaCita: fila.proximaCita
        ? {
            fecha: fechaCalendarioGT(fila.proximaCita),
            hora: horaGT(fila.proximaCita),
          }
        : null,
      referidaEl:
        fila.situacion === 'POR_AGENDAR' && fila.referidaEl
          ? fila.referidaEl.toISOString()
          : null,
    }));
  }

  async ficha(
    usuariaId: string,
    ahora: Date,
  ): Promise<FichaPacienteMedicaDto | null> {
    const usuaria = await this.prisma.usuaria.findFirst({
      where: {
        id: usuariaId,
        expedientes: { some: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: {
        id: true,
        ...SELECT_PERSONA,
        dpi: true,
        grupoEtnico: true,
        municipio: true,
        municipioOtro: true,
        departamentoOtro: true,
        telefono: true,
        direccion: true,
        updatedAt: true,
        expedientes: {
          where: EXPEDIENTE_REFERIDO_A_MEDICA,
          select: {
            id: true,
            numero: true,
            updatedAt: true,
            ninos: SELECT_NINOS,
            referidos: {
              where: { area: 'MEDICA' },
              select: { id: true, createdAt: true, motivo: true },
              orderBy: { createdAt: 'asc' },
            },
            atencionesMedicas: {
              select: SELECT_ATENCION_FICHA,
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!usuaria || usuaria.expedientes.length === 0) {
      return null;
    }

    const delaUsuaria = {
      atencion: { expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA } },
    } satisfies Prisma.ConsultaMedicaWhereInput;
    const sinRegistrarAntesDe = new Date(
      ahora.getTime() - DURACION_CITA_MEDICA_MIN * 60_000,
    );
    const SELECT_CITA_BREVE = {
      id: true,
      version: true,
      estado: true,
      inicio: true,
      duracionMin: true,
      personas: SELECT_PERSONAS_CITA,
    } as const;

    const [
      ultimaConsulta,
      proximaCita,
      citaSinRegistrar,
      signos,
      totalConsultas,
      totalDocumentos,
      psicologia,
      ultimasPorPersona,
      totalesPorPersona,
    ] = await Promise.all([
      this.prisma.consultaMedica.findFirst({
        where: delaUsuaria,
        select: { id: true, fechaHora: true, diagnostico: true },
        orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.citaMedica.findFirst({
        where: { ...delaUsuaria, estado: 'PROGRAMADA', inicio: { gt: ahora } },
        select: SELECT_CITA_BREVE,
        orderBy: { inicio: 'asc' },
      }),
      // Las más largas aún pueden estar en curso: se filtran con su propia duración.
      this.prisma.citaMedica
        .findMany({
          where: {
            ...delaUsuaria,
            estado: 'PROGRAMADA',
            inicio: { lte: sinRegistrarAntesDe },
          },
          select: SELECT_CITA_BREVE,
          orderBy: { inicio: 'asc' },
        })
        .then(
          (citas) =>
            citas.find(
              (cita) => derivarEstadoCita(cita, ahora) === 'SIN_REGISTRAR',
            ) ?? null,
        ),
      // Solo de la usuaria: los signos de sus hijos/as no se comparan con los de ella.
      this.prisma.consultaMedica.findMany({
        where: { ...delaUsuaria, ninoId: null },
        select: { fechaHora: true, ...SELECT_SIGNOS },
        orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
      this.prisma.consultaMedica.count({ where: delaUsuaria }),
      this.prisma.documentoMedico.count({ where: { consulta: delaUsuaria } }),
      this.vistaPsicologica(usuariaId),
      // La más reciente de cada persona (usuaria e hijos/as).
      this.prisma.consultaMedica.findMany({
        where: delaUsuaria,
        distinct: ['ninoId'],
        select: { id: true, ninoId: true, fechaHora: true, diagnostico: true },
        orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.consultaMedica.groupBy({
        by: ['ninoId'],
        where: delaUsuaria,
        _count: { _all: true },
      }),
    ]);

    // Situación y expediente de trabajo, sumando todos los expedientes referidos.
    const conActiva = usuaria.expedientes.find((e) =>
      e.atencionesMedicas.some((a) => a.estado === 'ACTIVA'),
    );
    const activa = conActiva?.atencionesMedicas.find(
      (a) => a.estado === 'ACTIVA',
    );
    let pendiente: FichaPacienteMedicaDto['pendiente'] = null;
    let conPendiente: (typeof usuaria.expedientes)[number] | undefined;
    for (const expediente of usuaria.expedientes) {
      const referencia = expediente.referidos.find((r) =>
        referenciaPendiente(r.createdAt, expediente.atencionesMedicas),
      );
      if (referencia) {
        conPendiente = expediente;
        pendiente = {
          referidoId: referencia.id,
          expedienteId: expediente.id,
          expedienteNumero: expediente.numero,
          referidoEn: referencia.createdAt.toISOString(),
          motivo: referencia.motivo,
        };
        break;
      }
    }
    const expediente = conActiva ?? conPendiente ?? usuaria.expedientes[0];

    const atenciones: AtencionMedicaResumenDto[] = usuaria.expedientes
      .flatMap((e) =>
        e.atencionesMedicas.map((a) => ({ atencion: a, expediente: e })),
      )
      .sort(
        (x, y) =>
          y.atencion.createdAt.getTime() - x.atencion.createdAt.getTime(),
      )
      .map(({ atencion, expediente: e }) => ({
        id: atencion.id,
        codigo: etiquetaAtencion(e.numero, atencion.consecutivo),
        estado: atencion.estado,
        expedienteId: e.id,
        expedienteNumero: e.numero,
        fechaInicio: fechaColumnaISO(atencion.fechaInicio),
        fechaAlta: atencion.fechaAlta
          ? fechaColumnaISO(atencion.fechaAlta)
          : null,
        motivoAlta: atencion.motivoAlta,
        consultas: atencion._count.consultas,
      }));

    const citaBreve = (cita: typeof proximaCita) =>
      cita
        ? {
            id: cita.id,
            version: cita.version,
            fecha: fechaCalendarioGT(cita.inicio),
            hora: horaGT(cita.inicio),
            horaFin: horaFin(horaGT(cita.inicio), cita.duracionMin),
            duracionMin: cita.duracionMin,
            personas: personasDeCita(usuaria, cita.personas),
          }
        : null;

    const [actual, anterior] = signos;
    return {
      usuariaId: usuaria.id,
      nombreCompleto: nombreCompleto(usuaria),
      dpi: usuaria.dpi,
      edad: edad(usuaria),
      fechaNacimiento: fechaColumnaISO(usuaria.fechaNacimiento),
      grupoEtnico: usuaria.grupoEtnico,
      municipio: procedencia(usuaria),
      telefono: usuaria.telefono,
      direccion: usuaria.direccion,
      // Medicina solo lee estos datos: el último cambio siempre es de Trabajo Social.
      actualizadoPorTsEn: new Date(
        Math.max(usuaria.updatedAt.getTime(), expediente.updatedAt.getTime()),
      ).toISOString(),
      situacion: situacionPaciente(!!activa, pendiente !== null),
      expedienteId: expediente.id,
      expedienteNumero: expediente.numero,
      personas: personasDelExpediente({
        usuaria,
        ninos: expediente.ninos,
      }),
      atencionActiva:
        activa && conActiva
          ? {
              ...atenciones.find((a) => a.id === activa.id)!,
              version: activa.version,
              visibleJuridico: activa.visibleJuridico,
              visiblePsicologia: activa.visiblePsicologia,
              motivoReferencia: activa.referido?.motivo ?? null,
            }
          : null,
      pendiente,
      atenciones,
      ultimaConsulta: ultimaConsulta
        ? {
            id: ultimaConsulta.id,
            fecha: fechaCalendarioGT(ultimaConsulta.fechaHora),
            hora: horaGT(ultimaConsulta.fechaHora),
            diagnostico: ultimaConsulta.diagnostico,
          }
        : null,
      consultasPorPersona: ultimasPorPersona.map((consulta) => ({
        ninoId: consulta.ninoId,
        total:
          totalesPorPersona.find((t) => t.ninoId === consulta.ninoId)?._count
            ._all ?? 0,
        ultima: {
          id: consulta.id,
          fecha: fechaCalendarioGT(consulta.fechaHora),
          hora: horaGT(consulta.fechaHora),
          diagnostico: consulta.diagnostico,
        },
      })),
      proximaCita: citaBreve(proximaCita),
      citaSinRegistrar: citaBreve(citaSinRegistrar),
      signosVitales: actual
        ? {
            fecha: fechaCalendarioGT(actual.fechaHora),
            hora: horaGT(actual.fechaHora),
            actual: signosDeFila(actual),
            anterior: anterior ? signosDeFila(anterior) : null,
          }
        : null,
      totalConsultas,
      totalDocumentos,
      psicologia,
    };
  }

  /**
   * Etapa y fechas del proceso psicológico más reciente, solo si Psicología lo compartió con
   * Medicina. Nunca notas de sesión.
   */
  private async vistaPsicologica(
    usuariaId: string,
  ): Promise<VistaPsicologicaParaMedicaDto | null> {
    const proceso = await this.prisma.atencionPsicologica.findFirst({
      where: {
        visibleMedica: true,
        expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: {
        consecutivo: true,
        estado: true,
        fechaInicio: true,
        createdAt: true,
        expediente: { select: { numero: true } },
        citas: {
          where: { estado: 'ATENDIDA' },
          select: { fechaHora: true },
          orderBy: { fechaHora: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!proceso) {
      return null;
    }
    return {
      codigo: etiquetaProceso(proceso.expediente.numero, proceso.consecutivo),
      etapa: ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[proceso.estado],
      fechaInicio: fechaCalendarioGT(proceso.fechaInicio ?? proceso.createdAt),
      sesiones: proceso.citas.map((c) => fechaCalendarioGT(c.fechaHora)),
    };
  }
}
