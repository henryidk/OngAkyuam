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
             e."condicionMaternidad", e."idiomaAtencion",
             u.nombres, u.apellidos, u.dpi, u."fechaNacimiento", u."grupoEtnico", u.municipio,
             u."departamentoOtro", u."municipioOtro", u."ubicacionGeografica",
             u.telefono, u."areaResidencia", u.ocupacion,
             cp."nombreCompleto" AS "atendidaPorNombre", cp.puesto AS "atendidaPorPuesto", cp.sede
      FROM "Expediente" e
      JOIN "Usuaria" u ON u.id = e."usuariaId"
      JOIN "Usuario" cp ON cp.id = e."creadoPorId"
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
             c."grupoEtnico", c.municipio, c."departamentoOtro", c."municipioOtro", c."ubicacionGeografica",
             NULL, c."areaResidencia", NULL, NULL, c."idiomaAtencion",
             c."atendidaPorNombre", c."atendidaPorPuesto", c.sede
      FROM casos c
      JOIN "Nino" n ON n."expedienteId" = c.id`
    : Prisma.empty;
  return Prisma.sql`
    ${cteCasos(filtro)},
    personas AS (
      SELECT c.id AS "expedienteId", c.numero, c.fecha, c."createdAt", c."tipoRegistro", c."tipologiaDelito",
             true AS "esUsuaria", NULL::text AS "ninoId", c.nombres, c.apellidos, c.dpi, c."fechaNacimiento",
             NULL::text AS "generoNino", c."grupoEtnico", c.municipio, c."departamentoOtro", c."municipioOtro",
             c."ubicacionGeografica",
             c.telefono, c."areaResidencia", c.ocupacion, c."condicionMaternidad", c."idiomaAtencion",
             c."atendidaPorNombre", c."atendidaPorPuesto", c.sede
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
             -- La base exige al menos una (Expediente_tipologia_obligatoria_chk); por si acaso, [] y no null.
             COALESCE(p."tipologiaDelito"::text[], '{}') AS tipologias,
             p."esUsuaria", p.nombres, p.apellidos, p.dpi,
             to_char(p."fechaNacimiento", 'YYYY-MM-DD') AS "fechaNacimiento",
             p.edad, p."generoNino",
             p."grupoEtnico"::text AS "grupoEtnico",
             p.municipio::text AS municipio,
             p."departamentoOtro", p."municipioOtro", p."ubicacionGeografica",
             p.telefono, p."areaResidencia"::text AS "areaResidencia", p.ocupacion,
             p."condicionMaternidad"::text AS "condicionMaternidad",
             p."idiomaAtencion"::text AS "idiomaAtencion",
             p."atendidaPorNombre", p."atendidaPorPuesto", p.sede::text AS sede,
             -- Referencias, bitácora de Trabajo Social y procesos jurídicos son del caso de la
             -- usuaria: no se repiten en las filas de sus hijas/hijos.
             CASE WHEN p."esUsuaria" THEN COALESCE((
               SELECT array_agg(r.area::text ORDER BY r."createdAt")
               FROM "ReferidoArea" r WHERE r."expedienteId" = p."expedienteId"
             ), '{}') ELSE '{}' END AS "areasReferidas",
             CASE WHEN p."esUsuaria" THEN (
               SELECT r.motivo FROM "ReferidoArea" r
               WHERE r."expedienteId" = p."expedienteId" AND btrim(COALESCE(r.motivo, '')) <> ''
               ORDER BY r."createdAt", r.id LIMIT 1
             ) END AS "motivoReferencia",
             CASE WHEN p."esUsuaria" THEN COALESCE((
               SELECT json_agg(json_build_object('fecha', to_char(a.fecha, 'YYYY-MM-DD'), 'texto', a.descripcion)
                               ORDER BY a.fecha, a."createdAt")
               FROM "AccionTrabajoSocial" a WHERE a."expedienteId" = p."expedienteId"
             ), '[]'::json) ELSE '[]'::json END AS "accionesTrabajoSocial",
             CASE WHEN p."esUsuaria" THEN COALESCE((
               SELECT array_agg(DISTINCT pj.tipo::text)
               FROM "ProcesoJuridico" pj WHERE pj."expedienteId" = p."expedienteId"
             ), '{}') ELSE '{}' END AS "procesosJuridicos",
             -- Atención psicológica y médica: de cada persona (la usuaria o esa hija/hijo).
             COALESCE((
               SELECT json_agg(json_build_object('fechaHora', ci."fechaHora", 'texto', ci."atencionBrindada")
                               ORDER BY ci."fechaHora")
               FROM "CitaPsicologica" ci
               JOIN "AtencionPsicologica" ap ON ap.id = ci."atencionId"
               WHERE ap."expedienteId" = p."expedienteId"
                 AND ci."ninoId" IS NOT DISTINCT FROM p."ninoId"
                 AND ci.estado = 'ATENDIDA' AND NOT ci.borrador
                 AND btrim(COALESCE(ci."atencionBrindada", '')) <> ''
             ), '[]'::json) AS "atencionesPsicologicas",
             COALESCE((
               SELECT json_agg(json_build_object('fechaHora', cm."fechaHora", 'texto', cm."atencionBrindada")
                               ORDER BY cm."fechaHora")
               FROM "ConsultaMedica" cm
               JOIN "AtencionMedica" am ON am.id = cm."atencionId"
               WHERE am."expedienteId" = p."expedienteId"
                 AND cm."ninoId" IS NOT DISTINCT FROM p."ninoId"
             ), '[]'::json) AS "atencionesMedicas"
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
