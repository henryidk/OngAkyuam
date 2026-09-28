import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { documentosRequeridos, type ResumenMesTs } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConsultaListaTs } from '../../estado/consulta-lista-ts';
import { cteEventos } from '../../eventos/sql-eventos';
import type {
  ColaRows,
  DocumentoPendienteRow,
  EnAlbergueRow,
  IBandejaRepository,
  NovedadRow,
  PendienteReferirRow,
  RecienteRow,
} from '../interfaces/bandeja-repository.interface';

type ConTotal<TFila> = TFila & { total: number };

function arrayTexto(valores: readonly string[]): Prisma.Sql {
  return Prisma.sql`ARRAY[${Prisma.join(valores)}]::text[]`;
}

/**
 * Tipos requeridos del caso según `documentosRequeridos()` de shared, en SQL — la regla sigue
 * viviendo en un solo lugar; aquí solo se enumeran sus tres combinaciones posibles. Se evalúa
 * sobre el alias `l` de la CTE `lista`.
 */
function expresionRequeridos(): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN l."tipoRegistro" = 'INTERNA' AND NOT l."enAlbergue" THEN ${arrayTexto(documentosRequeridos('INTERNA', true))}
    WHEN l."tipoRegistro" = 'INTERNA' THEN ${arrayTexto(documentosRequeridos('INTERNA', false))}
    ELSE ${arrayTexto(documentosRequeridos('EXTERNA', false))}
  END`;
}

/** Separa el `count(*) OVER ()` de cada fila en el total de la cola. */
function aCola<TFila>(filas: ConTotal<TFila>[]): ColaRows<TFila> {
  return {
    filas: filas.map((fila) => {
      const copia: Partial<ConTotal<TFila>> = { ...fila };
      delete copia.total;
      return copia as TFila;
    }),
    total: filas[0]?.total ?? 0,
  };
}

const COLUMNAS_CASO = Prisma.sql`"expedienteId", "usuariaId", numero, nombres, apellidos`;

@Injectable()
export class BandejaRepository implements IBandejaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultaLista: ConsultaListaTs,
  ) {}

  async pendientesReferir(
    limite: number,
  ): Promise<ColaRows<PendienteReferirRow>> {
    const filas = await this.prisma.$queryRaw<
      ConTotal<PendienteReferirRow>[]
    >(Prisma.sql`
      ${this.consultaLista.cteLista()}
      SELECT ${COLUMNAS_CASO}, "tipoRegistro", "casoCreadoEn", count(*) OVER ()::int AS total
      FROM lista
      WHERE estado = 'SIN_REFERIR'
      ORDER BY "casoCreadoEn" DESC, "usuariaId"
      LIMIT ${limite}
    `);
    return aCola(filas);
  }

  async documentosPendientes(
    limite: number,
  ): Promise<ColaRows<DocumentoPendienteRow>> {
    const filas = await this.prisma.$queryRaw<
      ConTotal<DocumentoPendienteRow>[]
    >(Prisma.sql`
      ${this.consultaLista.cteLista()},
      con_faltantes AS (
        SELECT l.*, ARRAY(
          SELECT t FROM unnest(${expresionRequeridos()}) WITH ORDINALITY AS r(t, orden)
          WHERE NOT EXISTS (
            SELECT 1 FROM "Documento" d
            WHERE d."expedienteId" = l."expedienteId" AND d.tipo::text = r.t AND d.vigente
          )
          ORDER BY r.orden
        ) AS faltantes
        FROM lista l
      )
      SELECT ${COLUMNAS_CASO}, faltantes, count(*) OVER ()::int AS total
      FROM con_faltantes
      WHERE cardinality(faltantes) > 0
      ORDER BY "casoCreadoEn" DESC, "usuariaId"
      LIMIT ${limite}
    `);
    return aCola(filas);
  }

  async enAlbergue(limite: number): Promise<ColaRows<EnAlbergueRow>> {
    const filas = await this.prisma.$queryRaw<
      ConTotal<EnAlbergueRow>[]
    >(Prisma.sql`
      ${this.consultaLista.cteLista()}
      SELECT ${COLUMNAS_CASO}, "fechaIngresoAlbergue", "cantidadNinos", count(*) OVER ()::int AS total
      FROM lista
      WHERE "enAlbergue"
      ORDER BY "fechaIngresoAlbergue" ASC NULLS LAST, "usuariaId"
      LIMIT ${limite}
    `);
    return aCola(filas);
  }

  recientes(limite: number): Promise<RecienteRow[]> {
    return this.prisma.$queryRaw<RecienteRow[]>(Prisma.sql`
      ${this.consultaLista.cteLista()}
      SELECT ${COLUMNAS_CASO}, areas, estado
      FROM lista
      WHERE estado <> 'SIN_REFERIR'
      ORDER BY "ultimaActividadEn" DESC, "usuariaId"
      LIMIT ${limite}
    `);
  }

  novedades(
    usuarioId: string,
    acciones: string[],
    limite: number,
  ): Promise<NovedadRow[]> {
    const casosDelUsuario = Prisma.sql`(
      e."creadoPorId" = ${usuarioId}
      OR EXISTS (SELECT 1 FROM "ReferidoArea" r WHERE r."expedienteId" = e.id AND r."otorgadoPorId" = ${usuarioId})
    )`;
    return this.prisma.$queryRaw<NovedadRow[]>(Prisma.sql`
      WITH ${cteEventos(acciones, casosDelUsuario)}
      SELECT ev.id, ev.accion, ev.detalles, ev."createdAt", ev."expedienteId",
        u.id AS "usuariaId", u.nombres, u.apellidos
      FROM eventos ev
      JOIN "Expediente" x ON x.id = ev."expedienteId"
      JOIN "Usuaria" u ON u.id = x."usuariaId"
      ORDER BY ev."createdAt" DESC, ev.id
      LIMIT ${limite}
    `);
  }

  async resumenMes(params: {
    anio: number;
    mes: number;
    inicio: Date;
    fin: Date;
  }): Promise<ResumenMesTs> {
    // `fecha` es `@db.Date` (día calendario): se compara con fechas, no con instantes.
    const primerDia = Prisma.sql`make_date(${params.anio}::int, ${params.mes}::int, 1)`;
    const [resumen] = await this.prisma.$queryRaw<ResumenMesTs[]>(Prisma.sql`
      SELECT
        (SELECT count(*)::int FROM "Expediente" e
          WHERE e.fecha >= ${primerDia} AND e.fecha < ${primerDia} + interval '1 month') AS "usuariasRegistradas",
        (SELECT count(*)::int FROM "Nino" n JOIN "Expediente" e ON e.id = n."expedienteId"
          WHERE e.fecha >= ${primerDia} AND e.fecha < ${primerDia} + interval '1 month') AS "ninosRegistrados",
        (SELECT count(*)::int FROM "ReferidoArea" r
          WHERE r."createdAt" BETWEEN ${params.inicio} AND ${params.fin}) AS referencias
    `);
    return resumen;
  }
}
