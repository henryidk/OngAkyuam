import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DURACION_CITA_MEDICA_MIN,
  fechaCalendarioGT,
  fechaColumnaISO,
  horaGT,
  etiquetaAtencion,
} from '@akyuam/shared';
import type {
  CitaAgendaMedicaDto,
  PacienteProgramableDto,
  ReferenciaBandejaMedicaDto,
  GrupoSinProximaMedica,
  SinProximaConsultaDto,
} from '@akyuam/shared';
import {
  SELECT_INGRESO_USUARIA,
  ingresoDeUsuaria,
} from '../../common/ingreso-area';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_HIJO,
  SELECT_PERSONA,
  edad,
  nombreCompleto,
  personasDelExpediente,
} from '../../psicologia/repositories/personas';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { horaFin } from '../dominio/horario';
import {
  puedeReprogramar,
  referenciaPendiente,
} from '../dominio/reglas-atencion';
import type {
  CitaResumida,
  ConteosSinProxima,
  FiltroProgramables,
  FiltroSinProxima,
  ILectorCitasMedicas,
  ILectorPendientesMedica,
} from '../interfaces/agenda-medica-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';
import { REFERIDO_SQL } from './pacientes-medica.repository';
import { condicionBusqueda } from '../../common/busqueda-usuarias';
import { SELECT_PERSONAS_CITA, personasDeCita } from './mapeo';
import { consecutivoSiguiente } from '../../common/consecutivo';

const SELECT_NINOS = {
  select: { id: true, ...SELECT_HIJO },
  orderBy: { consecutivo: 'asc' },
} as const;

type FilaSinProximaRow = {
  atencionId: string;
  version: number;
  consecutivo: number;
  fechaInicio: Date;
  expedienteId: string;
  expedienteNumero: string;
  usuariaId: string;
  nombres: string;
  apellidos: string;
  atendioPor: string | null;
  motivo: SinProximaConsultaDto['motivo'];
  grupo: GrupoSinProximaMedica;
  /** La falta (si es posterior a la última consulta) o la última consulta; null si no hay ninguna. */
  momento: Date | null;
};

/**
 * Atenciones activas de Medicina sin ninguna cita programada (ni futura ni sin registrar), con su
 * motivo y su grupo. La misma CTE lista y cuenta: el número de la tarjeta de la Agenda y el total
 * de la lista no pueden diferir. "Sin venir" compara contra el corte ya calculado en Guatemala
 * (`corteSinVenirMedica`): un instante cuenta si es anterior al día siguiente al corte, y la fecha
 * de inicio (sin hora) si es igual o anterior al corte.
 */
function cteSinProxima(filtro: Omit<FiltroSinProxima, 'grupo'>): Prisma.Sql {
  return Prisma.sql`
    WITH sin_proxima AS (
      SELECT base.*,
        CASE
          WHEN (CASE WHEN base.momento IS NOT NULL
                  THEN base.momento < ${filtro.corte.instante}
                  ELSE base."fechaInicio" <= ${filtro.corte.fecha}::date END)
            THEN 'SIN_VENIR'
          ELSE base.motivo
        END AS grupo
      FROM (
        SELECT
          a.id AS "atencionId",
          a.version,
          a.consecutivo,
          a."fechaInicio",
          e.id AS "expedienteId",
          e.numero AS "expedienteNumero",
          u.id AS "usuariaId",
          u.nombres,
          u.apellidos,
          c."atendioPor",
          CASE WHEN f.inicio IS NOT NULL AND (c."fechaHora" IS NULL OR f.inicio > c."fechaHora")
            THEN 'NO_ASISTIO' ELSE 'SIN_FECHA' END AS motivo,
          CASE WHEN f.inicio IS NOT NULL AND (c."fechaHora" IS NULL OR f.inicio > c."fechaHora")
            THEN f.inicio ELSE c."fechaHora" END AS momento
        FROM "AtencionMedica" a
        JOIN "Expediente" e ON e.id = a."expedienteId"
        JOIN "Usuaria" u ON u.id = e."usuariaId"
        LEFT JOIN LATERAL (
          SELECT cm."fechaHora", us."nombreCompleto" AS "atendioPor"
          FROM "ConsultaMedica" cm
          JOIN "Usuario" us ON us.id = cm."registradaPorId"
          WHERE cm."atencionId" = a.id
          ORDER BY cm."fechaHora" DESC
          LIMIT 1
        ) c ON TRUE
        LEFT JOIN LATERAL (
          SELECT ci.inicio FROM "CitaMedica" ci
          WHERE ci."atencionId" = a.id AND ci.estado = 'NO_ASISTIO'
          ORDER BY ci.inicio DESC
          LIMIT 1
        ) f ON TRUE
        WHERE a.estado = 'ACTIVA'
          AND ${REFERIDO_SQL}
          AND NOT EXISTS (
            SELECT 1 FROM "CitaMedica" cp
            WHERE cp."atencionId" = a.id AND cp.estado = 'PROGRAMADA'
          )
          AND ${condicionBusqueda(filtro.busqueda)}
      ) base
    )
  `;
}

/** La cita de la Agenda: nunca trae datos clínicos (ni motivo ni diagnóstico). */
function selectCitaAgenda(ahora: Date) {
  return {
    id: true,
    version: true,
    atencionId: true,
    inicio: true,
    duracionMin: true,
    estado: true,
    // Una consulta para "Ver consulta": la de la usuaria si vino.
    consultas: {
      select: { id: true },
      orderBy: [{ ninoId: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: 1,
    },
    reprogramadaA: { select: { id: true, inicio: true } },
    personas: SELECT_PERSONAS_CITA,
    atencion: {
      select: {
        consecutivo: true,
        estado: true,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: { select: { id: true, ...SELECT_PERSONA } },
          },
        },
        // ¿La paciente ya tiene otra cita futura? Decide si se ofrece "Reprogramar" en una
        // inasistencia.
        citas: {
          where: { estado: 'PROGRAMADA', inicio: { gt: ahora } },
          select: { id: true },
          take: 1,
        },
      },
    },
  } satisfies Prisma.CitaMedicaSelect;
}

type FilaCitaAgenda = Prisma.CitaMedicaGetPayload<{
  select: ReturnType<typeof selectCitaAgenda>;
}>;

function aCitaAgenda(fila: FilaCitaAgenda, ahora: Date): CitaAgendaMedicaDto {
  const { atencion } = fila;
  const { expediente } = atencion;
  const hora = horaGT(fila.inicio);
  return {
    id: fila.id,
    version: fila.version,
    atencionId: fila.atencionId,
    codigoAtencion: etiquetaAtencion(expediente.numero, atencion.consecutivo),
    expedienteId: expediente.id,
    usuariaId: expediente.usuaria.id,
    usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
    personas: personasDeCita(expediente.usuaria, fila.personas),
    inicio: fila.inicio.toISOString(),
    fecha: fechaCalendarioGT(fila.inicio),
    hora,
    horaFin: horaFin(hora, fila.duracionMin),
    duracionMin: fila.duracionMin,
    estado: fila.estado,
    estadoVista: derivarEstadoCita(fila, ahora),
    consultaId: fila.consultas[0]?.id ?? null,
    reprogramadaA: fila.reprogramadaA
      ? {
          id: fila.reprogramadaA.id,
          fecha: fechaCalendarioGT(fila.reprogramadaA.inicio),
          hora: horaGT(fila.reprogramadaA.inicio),
        }
      : null,
    puedeReprogramar: puedeReprogramar(
      {
        estado: fila.estado,
        inicio: fila.inicio,
        tieneConsultas: fila.consultas.length > 0,
        reprogramadaA: fila.reprogramadaA,
        atencionActiva: atencion.estado === 'ACTIVA',
        tieneCitaFutura: atencion.citas.length > 0,
      },
      ahora,
    ),
  };
}

/**
 * La regla de `referenciaPendiente` en SQL, sobre una referencia `r`: es a Medicina y su
 * expediente no tiene atención activa ni una abierta después de ella.
 */
const REFERENCIA_MEDICA_PENDIENTE_SQL = Prisma.sql`
  r.area = 'MEDICA'
  AND NOT EXISTS (
    SELECT 1 FROM "AtencionMedica" a
    WHERE a."expedienteId" = r."expedienteId"
      AND (a.estado = 'ACTIVA' OR a."createdAt" >= r."createdAt")
  )`;

@Injectable()
export class AgendaMedicaRepository
  implements ILectorCitasMedicas, ILectorPendientesMedica
{
  constructor(private readonly prisma: PrismaService) {}

  async citasEntre(
    desde: Date,
    hasta: Date,
    ahora: Date,
  ): Promise<CitaAgendaMedicaDto[]> {
    const filas = await this.prisma.citaMedica.findMany({
      where: {
        inicio: { gte: desde, lt: hasta },
        estado: { not: 'CANCELADA' },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: selectCitaAgenda(ahora),
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => aCitaAgenda(fila, ahora));
  }

  async citasSinRegistrar(
    ahora: Date,
    excluirDesde: Date,
    excluirHasta: Date,
  ): Promise<CitaAgendaMedicaDto[]> {
    // Ninguna cita dura menos que el bloque: las que empezaron después aún no terminan. Las más
    // largas se terminan de filtrar con su propia duración.
    const terminadasAntesDe = new Date(
      ahora.getTime() - DURACION_CITA_MEDICA_MIN * 60_000,
    );
    const filas = await this.prisma.citaMedica.findMany({
      where: {
        estado: 'PROGRAMADA',
        inicio: { lte: terminadasAntesDe },
        NOT: { inicio: { gte: excluirDesde, lt: excluirHasta } },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: selectCitaAgenda(ahora),
      // De la más reciente a la más antigua, como en Psicología: lo de ayer se recuerda mejor.
      orderBy: [{ inicio: 'desc' }, { id: 'asc' }],
    });
    return filas
      .filter((fila) => derivarEstadoCita(fila, ahora) === 'SIN_REGISTRAR')
      .map((fila) => aCitaAgenda(fila, ahora));
  }

  resumenEntre(desde: Date, hasta: Date): Promise<CitaResumida[]> {
    return this.prisma.citaMedica.findMany({
      where: {
        inicio: { gte: desde, lt: hasta },
        estado: { not: 'CANCELADA' },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: { inicio: true, estado: true, duracionMin: true },
    });
  }

  async referenciasPendientes(
    limite: number,
  ): Promise<ReferenciaBandejaMedicaDto[]> {
    // Prisma no compara columnas entre relaciones: los ids salen del SQL con la regla completa y
    // el tope; los datos de la tarjeta, de Prisma.
    const ids = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT r.id FROM "ReferidoArea" r
      WHERE ${REFERENCIA_MEDICA_PENDIENTE_SQL}
      ORDER BY r."createdAt" ASC, r.id ASC
      LIMIT ${limite}`);
    if (ids.length === 0) return [];
    const referidos = await this.prisma.referidoArea.findMany({
      where: { id: { in: ids.map((fila) => fila.id) } },
      select: {
        id: true,
        createdAt: true,
        motivo: true,
        otorgadoPor: { select: { nombreCompleto: true } },
        ...SELECT_INGRESO_USUARIA,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: { select: { id: true, ...SELECT_PERSONA } },
            ninos: SELECT_NINOS,
            atencionesMedicas: { select: { estado: true, createdAt: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return (
      referidos
        // La misma regla otra vez, ahora en el dominio: si una atención se abrió entre las dos
        // consultas, la referencia ya no está pendiente.
        .filter((r) =>
          referenciaPendiente(r.createdAt, r.expediente.atencionesMedicas),
        )
        .map((r) => ({
          referidoId: r.id,
          expedienteId: r.expediente.id,
          expedienteNumero: r.expediente.numero,
          usuariaId: r.expediente.usuaria.id,
          usuariaNombreCompleto: nombreCompleto(r.expediente.usuaria),
          edad: edad(r.expediente.usuaria),
          motivo: r.motivo,
          referidoEn: r.createdAt.toISOString(),
          referidoPor: r.otorgadoPor.nombreCompleto,
          personas: personasDelExpediente(r.expediente),
          ingreso: ingresoDeUsuaria(r),
        }))
    );
  }

  async contarReferenciasPendientes(): Promise<number> {
    const [fila] = await this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM "ReferidoArea" r
      WHERE ${REFERENCIA_MEDICA_PENDIENTE_SQL}`);
    return Number(fila?.total ?? 0);
  }

  async paginaSinProxima(
    filtro: FiltroSinProxima,
    pagina: number,
    porPagina: number,
  ): Promise<SinProximaConsultaDto[]> {
    const grupo = filtro.grupo
      ? Prisma.sql`grupo = ${filtro.grupo}`
      : Prisma.sql`TRUE`;
    const filas = await this.prisma.$queryRaw<FilaSinProximaRow[]>(Prisma.sql`
      ${cteSinProxima(filtro)}
      SELECT * FROM sin_proxima
      WHERE ${grupo}
      -- La más reciente primero: es la que todavía se recupera con una llamada. Sin consulta ni
      -- falta cuenta el inicio de la atención (fecha sin hora: puede quedar unas horas fuera de
      -- lugar entre filas del mismo día, nunca de otro grupo).
      ORDER BY coalesce(momento, "fechaInicio"::timestamptz) DESC, "atencionId"
      LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}
    `);
    return filas.map((fila): SinProximaConsultaDto => ({
      usuariaId: fila.usuariaId,
      expedienteId: fila.expedienteId,
      atencionId: fila.atencionId,
      atencionVersion: fila.version,
      codigoAtencion: etiquetaAtencion(fila.expedienteNumero, fila.consecutivo),
      usuariaNombreCompleto: nombreCompleto(fila),
      motivo: fila.motivo,
      grupo: fila.grupo,
      atendioPor: fila.atendioPor,
      desde: fila.momento
        ? fechaCalendarioGT(fila.momento)
        : fechaColumnaISO(fila.fechaInicio),
    }));
  }

  async conteosSinProxima(
    filtro: Omit<FiltroSinProxima, 'grupo'>,
  ): Promise<ConteosSinProxima> {
    const [conteos] = await this.prisma.$queryRaw<ConteosSinProxima[]>(
      Prisma.sql`
        ${cteSinProxima(filtro)}
        SELECT
          count(*)::int AS "TODAS",
          count(*) FILTER (WHERE grupo = 'NO_ASISTIO')::int AS "NO_ASISTIO",
          count(*) FILTER (WHERE grupo = 'SIN_FECHA')::int AS "SIN_FECHA",
          count(*) FILTER (WHERE grupo = 'SIN_VENIR')::int AS "SIN_VENIR"
        FROM sin_proxima
      `,
    );
    return conteos;
  }

  async programables(
    filtro: FiltroProgramables,
  ): Promise<PacienteProgramableDto[]> {
    const expedientes = await this.prisma.expediente.findMany({
      where: {
        ...EXPEDIENTE_REFERIDO_A_MEDICA,
        ...(filtro.usuariaId ? { usuariaId: filtro.usuariaId } : {}),
        ...(filtro.referidoId
          ? { referidos: { some: { id: filtro.referidoId, area: 'MEDICA' } } }
          : {}),
      },
      select: {
        id: true,
        numero: true,
        usuaria: { select: { id: true, ...SELECT_PERSONA } },
        ninos: SELECT_NINOS,
        referidos: {
          where: { area: 'MEDICA' },
          select: { id: true, createdAt: true, motivo: true },
        },
        atencionesMedicas: {
          select: {
            id: true,
            consecutivo: true,
            estado: true,
            createdAt: true,
          },
        },
      },
    });

    const programables: PacienteProgramableDto[] = [];
    for (const expediente of expedientes) {
      const base = {
        usuariaId: expediente.usuaria.id,
        usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
        expedienteId: expediente.id,
        expedienteNumero: expediente.numero,
        personas: personasDelExpediente(expediente),
      };
      const activa = expediente.atencionesMedicas.find(
        (a) => a.estado === 'ACTIVA',
      );
      if (activa) {
        programables.push({
          ...base,
          referidoId: null,
          atencionActiva: {
            id: activa.id,
            codigo: etiquetaAtencion(expediente.numero, activa.consecutivo),
          },
          codigoNuevaAtencion: null,
          motivoReferencia: null,
        });
        continue;
      }
      const referencia = expediente.referidos.find((r) =>
        referenciaPendiente(r.createdAt, expediente.atencionesMedicas),
      );
      if (referencia) {
        const siguiente = consecutivoSiguiente(
          expediente.atencionesMedicas.map((a) => a.consecutivo),
        );
        programables.push({
          ...base,
          referidoId: referencia.id,
          atencionActiva: null,
          codigoNuevaAtencion: etiquetaAtencion(expediente.numero, siguiente),
          motivoReferencia: referencia.motivo,
        });
      }
    }
    return programables.sort((a, b) =>
      a.usuariaNombreCompleto.localeCompare(b.usuariaNombreCompleto, 'es'),
    );
  }
}
