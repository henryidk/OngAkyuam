import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  carteraReporteSql,
  fechaCalendarioGTSql,
  PROCESO_ABIERTO_SQL,
} from '../compartido/sql';
import type {
  FilaPoblacionJuridicoRow,
  FiltroReportePoblacionJuridico,
  IReportePoblacionJuridicoRepository,
  TotalesPoblacionJuridicoRow,
} from '../interfaces/reporte-poblacion-juridico-repository.interface';

/**
 * Expedientes referidos a Jurídico (la misma regla de acceso del módulo), cada uno con su
 * "Día" y si sigue abierto, ya filtrados por cartera:
 * - "Día" = inicio del primer proceso; sin procesos, la fecha del referido en Guatemala.
 * - Abierto = algún proceso ni finalizado ni abandonado; sin procesos cuenta como abierto
 *   (la usuaria espera ser atendida).
 */
function cteExpedientes(filtro: FiltroReportePoblacionJuridico): Prisma.Sql {
  return Prisma.sql`
    expedientes AS (
      SELECT e.id, e.numero, e."createdAt", e."tipologiaDelito", e."usuariaId",
             COALESCE(min(p."fechaInicio"), ${fechaCalendarioGTSql(Prisma.sql`r."createdAt"`)}) AS dia,
             CASE WHEN count(p.id) = 0 THEN true ELSE bool_or(${PROCESO_ABIERTO_SQL}) END AS abierto
      FROM "ReferidoArea" r
      JOIN "Expediente" e ON e.id = r."expedienteId"
      LEFT JOIN "ProcesoJuridico" p ON p."expedienteId" = e.id
      WHERE r.area = 'JURIDICO'
      GROUP BY e.id, r.id
    ),
    enCartera AS (
      SELECT x.* FROM expedientes x
      WHERE ${carteraReporteSql(filtro, { fechaInicio: Prisma.sql`x.dia`, abierto: Prisma.sql`x.abierto` })}
    )`;
}

@Injectable()
export class ReportePoblacionJuridicoRepository implements IReportePoblacionJuridicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  filas(
    filtro: FiltroReportePoblacionJuridico,
    limite: number | null,
  ): Promise<FilaPoblacionJuridicoRow[]> {
    const porLimite =
      limite === null ? Prisma.empty : Prisma.sql`LIMIT ${limite}`;
    // Por "Día"; el instante de registro y el id desempatan para que el correlativo sea
    // estable entre la vista previa y el Excel.
    return this.prisma.$queryRaw<FilaPoblacionJuridicoRow[]>(Prisma.sql`
      WITH ${cteExpedientes(filtro)}
      SELECT (ROW_NUMBER() OVER w)::int AS numero,
             to_char(x.dia, 'YYYY-MM-DD') AS dia,
             x.numero AS "numeroCaso",
             u.nombres, u.apellidos, u.dpi,
             to_char(u."fechaNacimiento", 'YYYY-MM-DD') AS "fechaNacimiento",
             GREATEST(0, date_part('year', age(x.dia, u."fechaNacimiento")))::int AS edad,
             u."grupoEtnico"::text AS "grupoEtnico",
             u.municipio::text AS municipio,
             u."departamentoOtro", u."municipioOtro", u."ubicacionGeografica",
             -- La base exige al menos una (Expediente_tipologia_obligatoria_chk); por si acaso, [] y no null.
             COALESCE(x."tipologiaDelito"::text[], '{}') AS tipologias
      FROM enCartera x
      JOIN "Usuaria" u ON u.id = x."usuariaId"
      WINDOW w AS (ORDER BY x.dia, x."createdAt", x.id)
      ORDER BY numero
      ${porLimite}
    `);
  }

  async totales(
    filtro: FiltroReportePoblacionJuridico,
  ): Promise<TotalesPoblacionJuridicoRow> {
    const [fila] = await this.prisma.$queryRaw<
      TotalesPoblacionJuridicoRow[]
    >(Prisma.sql`
      WITH ${cteExpedientes(filtro)}
      SELECT count(*)::int AS expedientes,
             count(DISTINCT x."usuariaId")::int AS usuarias
      FROM enCartera x
    `);
    return fila ?? { expedientes: 0, usuarias: 0 };
  }
}
