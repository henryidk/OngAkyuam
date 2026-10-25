import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IndicadoresTs } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConsultaListaTs } from '../../estado/consulta-lista-ts';
import type {
  ColaRows,
  EnAlbergueRow,
  IBandejaRepository,
  PendienteReferirRow,
} from '../interfaces/bandeja-repository.interface';

type ConTotal<TFila> = TFila & { total: number };

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

  async indicadores(): Promise<IndicadoresTs> {
    const porArea = this.consultaLista.condicionesAreaActiva(
      Prisma.sql`l."expedienteId"`,
    );
    const [fila] = await this.prisma.$queryRaw<
      [Omit<IndicadoresTs, 'activosPorArea'> & { activos: number[] }]
    >(Prisma.sql`
      ${this.consultaLista.cteLista()}
      SELECT
        count(*) FILTER (WHERE l.estado = 'EN_ATENCION')::int AS "enAtencion",
        count(*) FILTER (WHERE l.estado = 'SIN_ATENCION_ACTIVA')::int AS "sinAtencionActiva",
        COALESCE(sum(l."cantidadNinos") FILTER (WHERE l."enAlbergue"), 0)::int AS "ninosEnAlbergue",
        ARRAY[${Prisma.join(
          porArea.map(
            ({ condicion }) =>
              Prisma.sql`count(*) FILTER (WHERE ${condicion})::int`,
          ),
        )}] AS activos
      FROM lista l
    `);
    const { activos, ...resto } = fila;
    return {
      ...resto,
      // El arreglo sale en el mismo orden que `porArea`.
      activosPorArea: porArea.map(({ area }, indice) => ({
        area,
        total: activos[indice],
      })),
    };
  }
}
