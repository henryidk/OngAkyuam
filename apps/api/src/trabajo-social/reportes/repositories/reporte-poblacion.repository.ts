import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ConteoDemograficoRow,
  ConteoTipologiaRow,
  FiltroReportePoblacion,
  FilaPoblacionRow,
  IReportePoblacionRepository,
} from '../interfaces/reporte-poblacion-repository.interface';

/** Casos cuya fecha (de calendario, `@db.Date`) cae en el rango, con los datos de la usuaria. */
function cteCasos(filtro: FiltroReportePoblacion): Prisma.Sql {
  const porTipo = filtro.tipoRegistro
    ? Prisma.sql`AND e."tipoRegistro" = ${filtro.tipoRegistro}::"TipoRegistro"`
    : Prisma.empty;
  return Prisma.sql`
    casos AS (
      SELECT e.id, e.numero, e.fecha, e."createdAt", e."tipoRegistro", e."tipologiaDelito",
             u.nombres, u.apellidos, u.dpi, u."fechaNacimiento", u."grupoEtnico", u.municipio,
             u."departamentoOtro", u."municipioOtro", u."ubicacionGeografica"
      FROM "Expediente" e
      JOIN "Usuaria" u ON u.id = e."usuariaId"
      WHERE e.fecha BETWEEN ${filtro.desde}::date AND ${filtro.hasta}::date
        ${porTipo}
    )`;
}

/**
 * Una fila por usuaria-caso y, si se piden, una por cada niño del caso. Los niños toman lugar
 * y grupo étnico de la madre. La edad se calcula a la fecha del caso con `age()` entre dos
 * fechas de calendario, así que no interviene ninguna zona horaria.
 */
function ctePersonas(filtro: FiltroReportePoblacion): Prisma.Sql {
  const ninos = filtro.incluirNinos
    ? Prisma.sql`
      UNION ALL
      SELECT c.id, c.numero, c.fecha, c."createdAt", c."tipoRegistro", c."tipologiaDelito",
             false, n.id, n.nombres, n.apellidos, NULL, n."fechaNacimiento", n.genero::text,
             c."grupoEtnico", c.municipio, c."departamentoOtro", c."municipioOtro", c."ubicacionGeografica"
      FROM casos c
      JOIN "Nino" n ON n."expedienteId" = c.id`
    : Prisma.empty;
  return Prisma.sql`
    ${cteCasos(filtro)},
    personas AS (
      SELECT c.id AS "expedienteId", c.numero, c.fecha, c."createdAt", c."tipoRegistro", c."tipologiaDelito",
             true AS "esUsuaria", NULL::text AS "ninoId", c.nombres, c.apellidos, c.dpi, c."fechaNacimiento",
             NULL::text AS "generoNino", c."grupoEtnico", c.municipio, c."departamentoOtro", c."municipioOtro",
             c."ubicacionGeografica"
      FROM casos c
      ${ninos}
    ),
    personas_edad AS (
      SELECT p.*, GREATEST(0, date_part('year', age(p.fecha, p."fechaNacimiento")))::int AS edad
      FROM personas p
    )`;
}

@Injectable()
export class ReportePoblacionRepository implements IReportePoblacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  filas(
    filtro: FiltroReportePoblacion,
    limite: number | null,
  ): Promise<FilaPoblacionRow[]> {
    const porLimite =
      limite === null ? Prisma.empty : Prisma.sql`LIMIT ${limite}`;
    // Orden: por fecha del caso y, dentro de cada caso, la usuaria primero y luego sus
    // hijas/hijos del mayor al menor. El id desempata para que el correlativo sea estable.
    return this.prisma.$queryRaw<FilaPoblacionRow[]>(Prisma.sql`
      WITH ${ctePersonas(filtro)}
      SELECT (ROW_NUMBER() OVER w)::int AS numero,
             to_char(p.fecha, 'YYYY-MM-DD') AS fecha,
             p.numero AS "numeroCaso",
             p."tipoRegistro"::text AS "tipoRegistro",
             p."tipologiaDelito"::text[] AS tipologias,
             p."esUsuaria", p.nombres, p.apellidos, p.dpi,
             to_char(p."fechaNacimiento", 'YYYY-MM-DD') AS "fechaNacimiento",
             p.edad, p."generoNino",
             p."grupoEtnico"::text AS "grupoEtnico",
             p.municipio::text AS municipio,
             p."departamentoOtro", p."municipioOtro", p."ubicacionGeografica"
      FROM personas_edad p
      WINDOW w AS (
        ORDER BY p.fecha, p."createdAt", p."expedienteId", p."esUsuaria" DESC,
                 p."fechaNacimiento", p."ninoId"
      )
      ORDER BY numero
      ${porLimite}
    `);
  }

  conteosDemograficos(
    filtro: FiltroReportePoblacion,
  ): Promise<ConteoDemograficoRow[]> {
    return this.prisma.$queryRaw<ConteoDemograficoRow[]>(Prisma.sql`
      WITH ${ctePersonas(filtro)}
      SELECT p."esUsuaria", p.edad, p."grupoEtnico"::text AS "grupoEtnico", count(*)::int AS total
      FROM personas_edad p
      GROUP BY p."esUsuaria", p.edad, p."grupoEtnico"
    `);
  }

  conteosTipologia(
    filtro: FiltroReportePoblacion,
  ): Promise<ConteoTipologiaRow[]> {
    return this.prisma.$queryRaw<ConteoTipologiaRow[]>(Prisma.sql`
      WITH ${cteCasos(filtro)}
      SELECT t.tipologia::text AS tipologia, count(*)::int AS total
      FROM casos c
      CROSS JOIN LATERAL unnest(c."tipologiaDelito") AS t(tipologia)
      GROUP BY t.tipologia
    `);
  }
}
