import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FORMAS_FINALIZACION_PROCESO,
  type FormaFinalizacionProceso,
  type MovimientoMesJuridico,
  type ProcesosPorTipoDto,
  type TipoProcesoJuridico,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EN_TRAMITE_SQL,
  PROCESO_CON_ACCESO_SQL,
  anioDeFechaSql,
} from '../compartido/sql';
import type {
  IInicioRepository,
  IndicadoresInicio,
} from '../interfaces/inicio-repository.interface';

/**
 * Acciones de `AuditLog` de Trabajo Social que avisan a Jurídico (ver `avisos-juridico.listener`).
 * Lista blanca: lecturas, descargas, cambios de visibilidad o cualquier cosa de otra área nunca
 * llegan aquí.
 */
export const ACCIONES_NOVEDAD_TS = {
  REFERENCIA: ['EXPEDIENTE_REFERIDO'],
  DATOS: ['USUARIA_ACTUALIZADA', 'USUARIA_DPI_MODIFICADO'],
  DOCUMENTO: ['DOCUMENTO_SUBIDO', 'DOCUMENTO_VERSION_SUBIDA'],
} as const;

interface FilaIndicadores {
  enTramite: bigint;
  suspendidos: bigint;
  abandonados: bigint;
  deSeguimiento: bigint;
  abiertos: bigint;
  finalizados: bigint;
}

interface FilaMes {
  mes: number;
  abiertos: bigint;
  finalizados: bigint;
}

interface FilaForma {
  forma: FormaFinalizacionProceso;
  total: bigint;
}

interface FilaPorTipo {
  tipo: TipoProcesoJuridico;
  total: bigint;
}

/** Los 12 meses del año, aunque no haya movimiento en alguno. */
export function completarMeses(filas: FilaMes[]): MovimientoMesJuridico[] {
  const porMes = new Map(filas.map((fila) => [Number(fila.mes), fila]));
  return Array.from({ length: 12 }, (_, indice) => {
    const fila = porMes.get(indice + 1);
    return {
      mes: indice + 1,
      abiertos: Number(fila?.abiertos ?? 0),
      finalizados: Number(fila?.finalizados ?? 0),
    };
  });
}

@Injectable()
export class InicioRepository implements IInicioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async indicadores(anio: number): Promise<IndicadoresInicio> {
    // `fechaInicio`, `fechaCierre` y `Expediente.fecha` son `@db.Date`: se comparan contra días
    // calendario, no instantes.
    const enElAnio = (columna: Prisma.Sql) => Prisma.sql`(
      ${columna} >= make_date(${anio}::int, 1, 1)
      AND ${columna} < make_date(${anio}::int + 1, 1, 1)
    )`;
    const inicio = Prisma.sql`p."fechaInicio"`;
    const cierre = Prisma.sql`p."fechaCierre"`;
    const finalizadoEnElAnio = Prisma.sql`p.fase = 'FINALIZADO' AND ${enElAnio(cierre)}`;
    const [[fila], meses, formas] = await Promise.all([
      this.prisma.$queryRaw<FilaIndicadores[]>(Prisma.sql`
        SELECT
          count(*) FILTER (WHERE ${EN_TRAMITE_SQL}) AS "enTramite",
          count(*) FILTER (
            WHERE p.fase <> 'FINALIZADO' AND p.situacion = 'SUSPENDIDO'
          ) AS suspendidos,
          count(*) FILTER (
            WHERE p.fase <> 'FINALIZADO' AND p.situacion = 'ABANDONADO'
          ) AS abandonados,
          count(*) FILTER (
            WHERE ${EN_TRAMITE_SQL} AND ${anioDeFechaSql(Prisma.sql`e.fecha`)} < ${anio}
          ) AS "deSeguimiento",
          count(*) FILTER (WHERE ${enElAnio(inicio)}) AS abiertos,
          count(*) FILTER (WHERE ${finalizadoEnElAnio}) AS finalizados
        FROM "ProcesoJuridico" p
        JOIN "Expediente" e ON e.id = p."expedienteId"
        WHERE ${PROCESO_CON_ACCESO_SQL}
      `),
      // Un proceso puede abrirse y cerrarse en meses distintos: cada fecha suma en su mes.
      this.prisma.$queryRaw<FilaMes[]>(Prisma.sql`
        SELECT m.mes,
          count(*) FILTER (WHERE m.tipo = 'ABIERTO') AS abiertos,
          count(*) FILTER (WHERE m.tipo = 'FINALIZADO') AS finalizados
        FROM (
          SELECT 'ABIERTO' AS tipo, extract(month FROM ${inicio})::int AS mes
          FROM "ProcesoJuridico" p
          WHERE ${PROCESO_CON_ACCESO_SQL} AND ${enElAnio(inicio)}
          UNION ALL
          SELECT 'FINALIZADO', extract(month FROM ${cierre})::int
          FROM "ProcesoJuridico" p
          WHERE ${PROCESO_CON_ACCESO_SQL} AND ${finalizadoEnElAnio}
        ) m
        GROUP BY m.mes
      `),
      this.prisma.$queryRaw<FilaForma[]>(Prisma.sql`
        SELECT p."formaFinalizacion" AS forma, count(*) AS total
        FROM "ProcesoJuridico" p
        WHERE ${PROCESO_CON_ACCESO_SQL} AND ${finalizadoEnElAnio}
          AND p."formaFinalizacion" IS NOT NULL
        GROUP BY p."formaFinalizacion"
      `),
    ]);
    const porForma = new Map(
      formas.map((forma) => [forma.forma, Number(forma.total)]),
    );
    return {
      cargaActual: {
        enTramite: Number(fila?.enTramite ?? 0),
        suspendidos: Number(fila?.suspendidos ?? 0),
        abandonados: Number(fila?.abandonados ?? 0),
        enTramiteDeSeguimiento: Number(fila?.deSeguimiento ?? 0),
      },
      movimientoAnio: {
        abiertos: Number(fila?.abiertos ?? 0),
        finalizados: Number(fila?.finalizados ?? 0),
        porMes: completarMeses(meses),
        finalizadosPorForma: Object.fromEntries(
          FORMAS_FINALIZACION_PROCESO.map((forma) => [
            forma,
            porForma.get(forma) ?? 0,
          ]),
        ) as Record<FormaFinalizacionProceso, number>,
      },
    };
  }

  async enTramitePorTipo(): Promise<ProcesosPorTipoDto[]> {
    const filas = await this.prisma.$queryRaw<FilaPorTipo[]>(Prisma.sql`
      SELECT p.tipo, count(*) AS total
      FROM "ProcesoJuridico" p
      WHERE ${PROCESO_CON_ACCESO_SQL} AND ${EN_TRAMITE_SQL}
      GROUP BY p.tipo
      ORDER BY total DESC, p.tipo
    `);
    return filas.map((fila) => ({
      tipo: fila.tipo,
      total: Number(fila.total),
    }));
  }
}
