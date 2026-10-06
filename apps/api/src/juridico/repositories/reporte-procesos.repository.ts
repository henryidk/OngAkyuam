import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ESTADO_VISIBLE_SQL, PROCESO_CON_ACCESO_SQL } from '../compartido/sql';
import type {
  ConteoProcesosRow,
  FilaProcesoRow,
  FiltroReporteProcesos,
  IReporteProcesosRepository,
} from '../interfaces/reporte-procesos-repository.interface';

/**
 * Procesos a los que Jurídico tiene acceso, iniciados en el rango, con los datos de la usuaria.
 * La edad se calcula a la fecha de inicio con `age()` entre dos fechas de calendario, así que
 * no interviene ninguna zona horaria.
 */
function cteProcesos(filtro: FiltroReporteProcesos): Prisma.Sql {
  const porEstado = filtro.estado
    ? Prisma.sql`AND ${ESTADO_VISIBLE_SQL} = ${filtro.estado}`
    : Prisma.empty;
  const porAbogada = filtro.abogadaId
    ? Prisma.sql`AND p."abogadaId" = ${filtro.abogadaId}`
    : Prisma.empty;
  return Prisma.sql`
    procesos AS (
      SELECT p.id, p.consecutivo, p."numeroJudicial", p."fechaInicio", p."fechaCierre", p."createdAt",
             p.tipo, p."formaFinalizacion", ${ESTADO_VISIBLE_SQL} AS estado,
             e.numero AS "expedienteNumero", e."usuariaId",
             u.nombres, u.apellidos, u."grupoEtnico", u.municipio, u."municipioOtro",
             GREATEST(0, date_part('year', age(p."fechaInicio", u."fechaNacimiento")))::int AS edad,
             pe.nombre AS abogada
      FROM "ProcesoJuridico" p
      JOIN "Expediente" e ON e.id = p."expedienteId"
      JOIN "Usuaria" u ON u.id = e."usuariaId"
      LEFT JOIN "Personal" pe ON pe.id = p."abogadaId"
      WHERE ${PROCESO_CON_ACCESO_SQL}
        AND p."fechaInicio" BETWEEN ${filtro.desde}::date AND ${filtro.hasta}::date
        ${porEstado}
        ${porAbogada}
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
    // sea estable entre la vista previa y el Excel.
    return this.prisma.$queryRaw<FilaProcesoRow[]>(Prisma.sql`
      WITH ${cteProcesos(filtro)}
      SELECT (ROW_NUMBER() OVER w)::int AS numero,
             p.consecutivo, p."expedienteNumero", p."numeroJudicial",
             to_char(p."fechaInicio", 'YYYY-MM-DD') AS "fechaInicio",
             to_char(p."fechaCierre", 'YYYY-MM-DD') AS "fechaCierre",
             p.tipo::text AS tipo, p.estado,
             p."formaFinalizacion"::text AS "formaFinalizacion",
             p.abogada, p.nombres, p.apellidos, p.edad,
             p."grupoEtnico"::text AS "grupoEtnico",
             p.municipio::text AS municipio, p."municipioOtro"
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

  async usuariasDistintas(filtro: FiltroReporteProcesos): Promise<number> {
    const [fila] = await this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      WITH ${cteProcesos(filtro)}
      SELECT count(DISTINCT p."usuariaId")::int AS total FROM procesos p
    `);
    return fila?.total ?? 0;
  }
}
