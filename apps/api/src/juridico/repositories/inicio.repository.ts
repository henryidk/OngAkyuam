import { Injectable } from '@nestjs/common';
import { Prisma, type TipoDocumento } from '@prisma/client';
import {
  TIPOS_DOCUMENTO_RESTRINGIBLES,
  type ColaInicio,
  type NovedadTsDto,
  type ProcesoResumen,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EN_TRAMITE_SQL,
  PROCESO_CON_ACCESO_SQL,
  asignadoASql,
} from '../compartido/sql';
import { limiteInactividad } from '../dominio/estado-visible';
import type {
  ColaProcesosInicio,
  IInicioRepository,
  ResumenAnioJuridico,
} from '../interfaces/inicio-repository.interface';
import { cargarResumenes, nombreCompleto } from './mapeo-proceso';

/**
 * Acciones de `AuditLog` que Jurídico ve como novedad de Trabajo Social. Lista blanca: lecturas,
 * descargas, cambios de visibilidad o cualquier cosa de otra área nunca llegan aquí.
 */
export const ACCIONES_NOVEDAD_TS = {
  REFERENCIA: ['EXPEDIENTE_REFERIDO'],
  DATOS: ['USUARIA_ACTUALIZADA', 'USUARIA_DPI_MODIFICADO'],
  DOCUMENTO: ['DOCUMENTO_SUBIDO', 'DOCUMENTO_VERSION_SUBIDA'],
} as const;

interface FilaCola {
  id: string;
  total: bigint;
}

interface FilaResumenAnio {
  total: bigint;
  enTramite: bigint;
  finalizados: bigint;
}

interface FilaNovedad {
  id: string;
  tipo: NovedadTsDto['tipo'];
  createdAt: Date;
  detalles: Prisma.JsonValue;
  usuariaId: string;
  nombres: string;
  apellidos: string;
  numero: string;
  documentoTipo: TipoDocumento | null;
  documentoVersion: number | null;
}

function condicionCola(filtro: ColaProcesosInicio): {
  donde: Prisma.Sql;
  orden: Prisma.Sql;
} {
  switch (filtro.cola) {
    case 'ATENCION':
      return {
        donde: Prisma.sql`${EN_TRAMITE_SQL} AND p."ultimaActuacionEn" < ${limiteInactividad()}`,
        orden: Prisma.sql`p."ultimaActuacionEn" ASC`,
      };
    case 'MIOS':
      return {
        donde: Prisma.sql`${EN_TRAMITE_SQL} AND ${asignadoASql(filtro.usuarioId)}`,
        orden: Prisma.sql`p."ultimaActuacionEn" DESC`,
      };
    case 'RECIENTES':
      return {
        donde: Prisma.sql`p.fase <> 'FINALIZADO'`,
        orden: Prisma.sql`p."ultimaActuacionEn" DESC`,
      };
  }
}

/** Solo los nombres de campo que vienen en `detalles.campos`; nunca hay valores ahí. */
function camposDe(detalles: Prisma.JsonValue): string[] {
  if (detalles && typeof detalles === 'object' && !Array.isArray(detalles)) {
    const campos = detalles.campos;
    if (Array.isArray(campos)) {
      return campos.filter(
        (campo): campo is string => typeof campo === 'string',
      );
    }
  }
  return [];
}

function mapearNovedad(fila: FilaNovedad): NovedadTsDto | null {
  const base = {
    id: fila.id,
    createdAt: fila.createdAt.toISOString(),
    usuaria: { id: fila.usuariaId, nombreCompleto: nombreCompleto(fila) },
    expedienteNumero: fila.numero,
  };
  switch (fila.tipo) {
    case 'REFERENCIA':
      return { ...base, tipo: 'REFERENCIA' };
    case 'DATOS':
      return { ...base, tipo: 'DATOS', campos: camposDe(fila.detalles) };
    case 'DOCUMENTO':
      // El documento pudo borrarse después del evento: sin él no hay nada que contar.
      return fila.documentoTipo && fila.documentoVersion
        ? {
            ...base,
            tipo: 'DOCUMENTO',
            documento: {
              tipo: fila.documentoTipo,
              version: fila.documentoVersion,
            },
          }
        : null;
  }
}

@Injectable()
export class InicioRepository implements IInicioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async colaProcesos(
    filtro: ColaProcesosInicio,
    limite: number,
  ): Promise<ColaInicio<ProcesoResumen>> {
    const { donde, orden } = condicionCola(filtro);
    // `count(*) OVER ()`: el total de la cola viaja en la misma consulta que sus filas.
    const filas = await this.prisma.$queryRaw<FilaCola[]>(Prisma.sql`
      SELECT p.id, count(*) OVER () AS total
      FROM "ProcesoJuridico" p
      WHERE ${PROCESO_CON_ACCESO_SQL} AND ${donde}
      ORDER BY ${orden}, p.id
      LIMIT ${limite}
    `);
    return {
      items: await cargarResumenes(
        this.prisma,
        filas.map((fila) => fila.id),
      ),
      total: Number(filas[0]?.total ?? 0),
    };
  }

  async resumenAnio(anio: number): Promise<ResumenAnioJuridico> {
    // `fechaInicio` es `@db.Date`: se compara contra días calendario, no contra instantes.
    const [fila] = await this.prisma.$queryRaw<FilaResumenAnio[]>(Prisma.sql`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE ${EN_TRAMITE_SQL}) AS "enTramite",
        count(*) FILTER (WHERE p.fase = 'FINALIZADO') AS finalizados
      FROM "ProcesoJuridico" p
      WHERE ${PROCESO_CON_ACCESO_SQL}
        AND p."fechaInicio" >= make_date(${anio}::int, 1, 1)
        AND p."fechaInicio" < make_date(${anio}::int + 1, 1, 1)
    `);
    return {
      total: Number(fila?.total ?? 0),
      enTramite: Number(fila?.enTramite ?? 0),
      finalizados: Number(fila?.finalizados ?? 0),
    };
  }

  async tieneFichaPersonal(usuarioId: string): Promise<boolean> {
    const ficha = await this.prisma.personal.findFirst({
      where: { usuarioId, area: 'JURIDICO' },
      select: { id: true },
    });
    return ficha !== null;
  }

  async novedadesTs(limite: number): Promise<NovedadTsDto[]> {
    // Cada rama parte de un expediente referido a Jurídico y solo toma eventos posteriores a
    // la referencia, hechos por una cuenta de Trabajo Social. Los documentos además pasan por
    // la misma regla de visibilidad que `PoliticaJuridico`: los de Trabajo Social siempre, los
    // de otras áreas solo si se compartieron con Jurídico.
    const deTrabajoSocial = Prisma.sql`EXISTS (
      SELECT 1 FROM "Usuario" act WHERE act.id = a."usuarioId" AND act.rol = 'TRABAJO_SOCIAL'
    )`;
    const filas = await this.prisma.$queryRaw<FilaNovedad[]>(Prisma.sql`
      WITH referidos AS (
        SELECT r."expedienteId", r."createdAt" AS "referidoEn", e.numero, e."usuariaId"
        FROM "ReferidoArea" r
        JOIN "Expediente" e ON e.id = r."expedienteId"
        WHERE r.area = 'JURIDICO'
      ),
      eventos AS (
        SELECT a.id, 'REFERENCIA' AS tipo, a."createdAt", a.detalles,
          ref."usuariaId", ref.numero,
          NULL::"TipoDocumento" AS "documentoTipo", NULL::int AS "documentoVersion"
        FROM referidos ref
        JOIN "AuditLog" a ON a.entidad = 'Expediente' AND a."entidadId" = ref."expedienteId"
        WHERE a.accion IN (${Prisma.join(ACCIONES_NOVEDAD_TS.REFERENCIA)})
          AND a.detalles->>'area' = 'JURIDICO'
          AND ${deTrabajoSocial}
        UNION ALL
        SELECT a.id, 'DOCUMENTO', a."createdAt", a.detalles,
          ref."usuariaId", ref.numero, d.tipo, d.version
        FROM referidos ref
        JOIN "Documento" d ON d."expedienteId" = ref."expedienteId"
        JOIN "AuditLog" a ON a.entidad = 'Documento' AND a."entidadId" = d.id
        WHERE a.accion IN (${Prisma.join(ACCIONES_NOVEDAD_TS.DOCUMENTO)})
          AND a."createdAt" >= ref."referidoEn"
          AND ${deTrabajoSocial}
          AND (
            d.tipo::text IN (${Prisma.join(TIPOS_DOCUMENTO_RESTRINGIBLES)})
            OR EXISTS (
              SELECT 1 FROM "DocumentoVisibilidadArea" v
              WHERE v."documentoId" = d.id AND v.area = 'JURIDICO'
            )
          )
        UNION ALL
        SELECT DISTINCT ON (a.id) a.id, 'DATOS', a."createdAt", a.detalles,
          ref."usuariaId", ref.numero,
          NULL::"TipoDocumento", NULL::int
        FROM referidos ref
        JOIN "AuditLog" a ON a.entidad = 'Usuaria' AND a."entidadId" = ref."usuariaId"
        WHERE a.accion IN (${Prisma.join(ACCIONES_NOVEDAD_TS.DATOS)})
          AND a."createdAt" >= ref."referidoEn"
          AND jsonb_typeof(a.detalles->'campos') = 'array'
          AND jsonb_array_length(a.detalles->'campos') > 0
          AND ${deTrabajoSocial}
      )
      SELECT ev.id, ev.tipo, ev."createdAt", ev.detalles, ev."usuariaId", ev.numero,
        ev."documentoTipo", ev."documentoVersion", u.nombres, u.apellidos
      FROM eventos ev
      JOIN "Usuaria" u ON u.id = ev."usuariaId"
      ORDER BY ev."createdAt" DESC, ev.id
      LIMIT ${limite}
    `);
    return filas.flatMap((fila) => {
      const novedad = mapearNovedad(fila);
      return novedad ? [novedad] : [];
    });
  }
}
