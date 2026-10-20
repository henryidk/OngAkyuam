import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  carteraReporteSql,
  ESTADO_VISIBLE_SQL,
  PROCESO_ABIERTO_SQL,
  PROCESO_CON_ACCESO_SQL,
} from '../compartido/sql';
import type {
  ConteoProcesosRow,
  FilaProcesoRow,
  FiltroReporteProcesos,
  IReporteProcesosRepository,
  TotalesPersonasRow,
} from '../interfaces/reporte-procesos-repository.interface';

/** Procesos a los que Jurídico tiene acceso que entran en la cartera y los filtros pedidos. */
function cteProcesos(filtro: FiltroReporteProcesos): Prisma.Sql {
  const porEstado = filtro.estado
    ? Prisma.sql`AND ${ESTADO_VISIBLE_SQL} = ${filtro.estado}`
    : Prisma.empty;
  const porAbogada = filtro.abogadaId
    ? Prisma.sql`AND p."abogadaId" = ${filtro.abogadaId}`
    : Prisma.empty;
  const porTipo = filtro.tipo
    ? Prisma.sql`AND p.tipo = ${filtro.tipo}::"TipoProcesoJuridico"`
    : Prisma.empty;
  return Prisma.sql`
    procesos AS (
      SELECT p.id, p.consecutivo, p."numeroJudicial", p."fechaInicio", p."fechaCierre", p."createdAt",
             p.tipo, p."formaFinalizacion", ${ESTADO_VISIBLE_SQL} AS estado,
             ${PROCESO_ABIERTO_SQL} AS abierto,
             e.id AS "expedienteId", e.numero AS "expedienteNumero", e."usuariaId",
             u.nombres, u.apellidos, pe.nombre AS abogada
      FROM "ProcesoJuridico" p
      JOIN "Expediente" e ON e.id = p."expedienteId"
      JOIN "Usuaria" u ON u.id = e."usuariaId"
      LEFT JOIN "Personal" pe ON pe.id = p."abogadaId"
      WHERE ${PROCESO_CON_ACCESO_SQL}
        AND ${carteraReporteSql(filtro)}
        ${porEstado}
        ${porAbogada}
        ${porTipo}
    )`;
}

@Injectable()
export class ReporteProcesosRepository implements IReporteProcesosRepository {
  constructor(private readonly prisma: PrismaService) {}

  filas(
    filtro: FiltroReporteProcesos,
    limite: number | null,
  ): Promise<FilaProcesoRow[]> {
    const porLimite =
      limite === null ? Prisma.empty : Prisma.sql`LIMIT ${limite}`;
    // Por fecha de inicio; el instante de registro y el id desempatan para que el correlativo
    // sea estable entre la vista previa y el Excel. La próxima audiencia es la programada más
    // cercana aunque ya haya pasado sin resultado, igual que en la lista de Procesos.
    return this.prisma.$queryRaw<FilaProcesoRow[]>(Prisma.sql`
      WITH ${cteProcesos(filtro)}
      SELECT (ROW_NUMBER() OVER w)::int AS numero,
             p.consecutivo, p."expedienteNumero", p."numeroJudicial",
             to_char(p."fechaInicio", 'YYYY-MM-DD') AS "fechaInicio",
             to_char(p."fechaCierre", 'YYYY-MM-DD') AS "fechaCierre",
             p.tipo::text AS tipo, p.estado, p.abierto,
             p."formaFinalizacion"::text AS "formaFinalizacion",
             p.abogada, p.nombres, p.apellidos,
             (SELECT min(a.inicio) FROM "AudienciaJuridica" a
               WHERE a."procesoId" = p.id AND a.estado = 'PROGRAMADA') AS "proximaAudiencia",
             (SELECT max(a.inicio) FROM "AudienciaJuridica" a
               WHERE a."procesoId" = p.id AND a.estado = 'REALIZADA') AS "ultimaAudienciaRealizada"
      FROM procesos p
      WINDOW w AS (ORDER BY p."fechaInicio", p."createdAt", p.id)
      ORDER BY numero
      ${porLimite}
    `);
  }

  conteos(filtro: FiltroReporteProcesos): Promise<ConteoProcesosRow[]> {
    return this.prisma.$queryRaw<ConteoProcesosRow[]>(Prisma.sql`
      WITH ${cteProcesos(filtro)}
      SELECT p.estado, p."formaFinalizacion"::text AS "formaFinalizacion",
             p.tipo::text AS tipo, count(*)::int AS total
      FROM procesos p
      GROUP BY p.estado, p."formaFinalizacion", p.tipo
    `);
  }

  async totalesPersonas(
    filtro: FiltroReporteProcesos,
  ): Promise<TotalesPersonasRow> {
    const [fila] = await this.prisma.$queryRaw<TotalesPersonasRow[]>(Prisma.sql`
      WITH ${cteProcesos(filtro)}
      SELECT count(DISTINCT p."expedienteId")::int AS expedientes,
             count(DISTINCT p."usuariaId")::int AS usuarias
      FROM procesos p
    `);
    return fila ?? { expedientes: 0, usuarias: 0 };
  }
}
