import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  etiquetaProcesoPsicologia,
  nombreMunicipio,
  type FiltroUsuariasPsicologia,
  type ListaUsuariasPsicologia,
} from '@akyuam/shared';
import { condicionBusqueda } from '../../common/busqueda-usuarias';
import { PrismaService } from '../../prisma/prisma.service';
import { estadoReferencia } from '../dominio/estado-referencia';
import type {
  FichaUsuariaRepo,
  IUsuariasPsicologiaRepository,
  ListarUsuariasPsicologiaParams,
} from '../interfaces/usuarias-psicologia-repository.interface';
import {
  EXPEDIENTE_DE_PSICOLOGIA,
  EXPEDIENTE_DE_PSICOLOGIA_SQL,
  EXPEDIENTE_TOMADO,
  procesoAbiertoDePersona,
  sinTomarSql,
} from './acceso-expediente';
import { hijoDeFicha } from './hijos-ficha.mapper';
import { edad, nombreCompleto, SELECT_PERSONA } from './personas';

/** Tope de referencias en la ficha: una usuaria tiene a lo más una por expediente. */
const LIMITE_REFERENCIAS = 100;

type FilaListaRow = {
  usuariaId: string;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: Date;
  expedienteNumero: string;
  activos: number;
  total: number;
  referenciaPendiente: boolean;
  sinTomar: boolean;
  ultimaActividadEn: Date;
};

type ContadoresRow = { TODAS: number } & Record<
  FiltroUsuariasPsicologia,
  number
>;

/**
 * Una fila por usuaria con algún expediente referido a Psicología. Procesos y referencias se
 * agregan por usuaria (no por expediente) y cuentan los de toda el área, de ella y de sus
 * hijos/as; solo "por agendar" es personal: es un caso que tomó esta psicóloga.
 */
function cteLista(params: ListarUsuariasPsicologiaParams) {
  const accesible = EXPEDIENTE_DE_PSICOLOGIA_SQL;
  return Prisma.sql`
    WITH lista AS (
      SELECT
        u.id AS "usuariaId",
        u.nombres,
        u.apellidos,
        u.dpi,
        u."fechaNacimiento",
        ex.numero AS "expedienteNumero",
        p.activos,
        p.total,
        (r.sin_tomar OR p.por_agendar) AS "referenciaPendiente",
        r.sin_tomar AS "sinTomar",
        GREATEST(r.ultima, p.ultima) AS "ultimaActividadEn"
      FROM "Usuaria" u
      -- El expediente visible más reciente; sin ninguno, la usuaria no aparece.
      JOIN LATERAL (
        SELECT e.numero
        FROM "Expediente" e
        WHERE e."usuariaId" = u.id AND ${accesible}
        ORDER BY e.fecha DESC, e."createdAt" DESC
        LIMIT 1
      ) ex ON TRUE
      CROSS JOIN LATERAL (
        SELECT
          max(ra."createdAt") AS ultima,
          coalesce(bool_or(${sinTomarSql(Prisma.sql`e.id`)}), FALSE) AS sin_tomar
        FROM "ReferidoArea" ra
        JOIN "Expediente" e ON e.id = ra."expedienteId"
        WHERE e."usuariaId" = u.id AND ra.area = 'PSICOLOGIA' AND ${accesible}
      ) r
      CROSS JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE ap.estado <> 'CIERRE' AND ap."fechaInicio" IS NOT NULL)::int AS activos,
          count(*) FILTER (WHERE ap.estado = 'CIERRE' OR ap."fechaInicio" IS NOT NULL)::int AS total,
          -- Caso que tomé y todavía no agendo: sigue siendo una referencia por atender.
          coalesce(bool_or(
            ap.estado <> 'CIERRE' AND ap."fechaInicio" IS NULL
            AND ap."psicologaAsignadaId" = ${params.psicologaId}
          ), FALSE) AS por_agendar,
          max(ap."updatedAt") AS ultima
        FROM "AtencionPsicologica" ap
        JOIN "Expediente" e ON e.id = ap."expedienteId"
        WHERE e."usuariaId" = u.id AND ${accesible}
      ) p
      WHERE ${condicionBusqueda(params.busqueda)}
    )
  `;
}

const FILTRO_SQL: Record<FiltroUsuariasPsicologia, Prisma.Sql> = {
  CON_ACTIVO: Prisma.sql`activos > 0`,
  SIN_ACTIVO: Prisma.sql`NOT "referenciaPendiente" AND activos = 0`,
};

@Injectable()
export class UsuariasPsicologiaRepository implements IUsuariasPsicologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    params: ListarUsuariasPsicologiaParams,
  ): Promise<ListaUsuariasPsicologia> {
    const base = cteLista(params);
    const filtro = params.filtro ? FILTRO_SQL[params.filtro] : Prisma.sql`TRUE`;
    const [filas, [contadores]] = await Promise.all([
      this.prisma.$queryRaw<FilaListaRow[]>(Prisma.sql`
        ${base}
        SELECT * FROM lista
        WHERE ${filtro}
        ORDER BY "ultimaActividadEn" DESC, "usuariaId"
        LIMIT ${params.porPagina} OFFSET ${(params.pagina - 1) * params.porPagina}
      `),
      this.prisma.$queryRaw<ContadoresRow[]>(Prisma.sql`
        ${base}
        SELECT
          count(*)::int AS "TODAS",
          count(*) FILTER (WHERE ${FILTRO_SQL.CON_ACTIVO})::int AS "CON_ACTIVO",
          count(*) FILTER (WHERE ${FILTRO_SQL.SIN_ACTIVO})::int AS "SIN_ACTIVO"
        FROM lista
      `),
    ]);

    return {
      filas: filas.map((fila) => ({
        usuariaId: fila.usuariaId,
        nombreCompleto: nombreCompleto(fila),
        dpi: fila.dpi,
        edad: edad(fila),
        expedienteNumero: fila.expedienteNumero,
        estadoProceso:
          fila.activos > 0 ? 'ACTIVO' : fila.total > 0 ? 'CERRADO' : null,
        // Un proceso abierto por persona: cada uno es alguien de la familia en atención.
        personasEnAtencion: fila.activos,
        referenciaPendiente: !fila.referenciaPendiente
          ? null
          : fila.sinTomar
            ? 'SIN_TOMAR'
            : 'POR_AGENDAR',
        ultimaActividadEn: fila.ultimaActividadEn.toISOString(),
      })),
      pagina: params.pagina,
      porPagina: params.porPagina,
      total: params.filtro ? contadores[params.filtro] : contadores.TODAS,
      contadores,
    };
  }

  async obtenerFicha(
    usuariaId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<FichaUsuariaRepo | null> {
    const accesible = EXPEDIENTE_DE_PSICOLOGIA;
    const usuaria = await this.prisma.usuaria.findFirst({
      where: { id: usuariaId, expedientes: { some: accesible } },
      select: {
        id: true,
        ...SELECT_PERSONA,
        dpi: true,
        grupoEtnico: true,
        municipio: true,
        municipioOtro: true,
        expedientes: {
          where: accesible,
          select: {
            id: true,
            numero: true,
            tipoRegistro: true,
            fechaEgresoAlbergue: true,
          },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });
    const expediente = usuaria?.expedientes[0];
    if (!usuaria || !expediente) {
      return null;
    }

    const [referencias, expedienteTomado, usuariaConProceso, ninos] =
      await Promise.all([
        this.prisma.referidoArea.findMany({
          where: {
            area: 'PSICOLOGIA',
            expediente: { usuariaId, ...accesible },
          },
          select: {
            id: true,
            expedienteId: true,
            createdAt: true,
            motivo: true,
            otorgadoPor: { select: { nombreCompleto: true } },
            expediente: {
              select: {
                numero: true,
                atencionesPsicologicas: {
                  where: { psicologaAsignadaId: { not: null } },
                  select: {
                    referidoId: true,
                    fechaInicio: true,
                    estado: true,
                    psicologaAsignadaId: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: LIMITE_REFERENCIAS,
        }),
        // El mismo expediente en el que `abrirNuevo` abriría el proceso de la usuaria.
        this.prisma.expediente.findFirst({
          where: { usuariaId, ...EXPEDIENTE_TOMADO },
          select: {
            id: true,
            numero: true,
            atencionesPsicologicas: {
              where: { ninoId: null },
              select: { consecutivo: true },
              orderBy: { consecutivo: 'desc' },
              take: 1,
            },
          },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        }),
        // De cualquier psicóloga: "un solo proceso abierto por persona" es de toda el área. Solo
        // se usa para el sí/no del botón de la usuaria; los hijos/as se abren cada uno aparte.
        this.prisma.atencionPsicologica.findFirst({
          where: procesoAbiertoDePersona({ usuariaId, ninoId: null }),
          select: { id: true },
        }),
        this.prisma.nino.findMany({
          where: { expedienteId: expediente.id },
          orderBy: { consecutivo: 'asc' },
          select: {
            id: true,
            consecutivo: true,
            ...SELECT_PERSONA,
            genero: true,
            // Los de cualquier psicóloga: la lectura es de toda el área.
            atencionesPsicologicas: {
              select: {
                id: true,
                consecutivo: true,
                estado: true,
                fechaCierre: true,
                psicologaAsignada: {
                  select: { nombreCompleto: true, puesto: true },
                },
                citas: {
                  where: { estado: 'PROGRAMADA', fechaHora: { gte: ahora } },
                  select: { fechaHora: true },
                  orderBy: { fechaHora: 'asc' },
                  take: 1,
                },
              },
              orderBy: { consecutivo: 'desc' },
            },
          },
        }),
      ]);

    // Los hijos/as son del expediente de la ficha y ahí se abren sus procesos, si ya se tomó. Es
    // el más reciente de los visibles: si está tomado, también es el tomado más reciente.
    const expedienteFichaTomado = expedienteTomado?.id === expediente.id;

    const historial = referencias.map((referencia) => {
      const estado = estadoReferencia(
        referencia.id,
        referencia.expediente.atencionesPsicologicas,
        psicologaId,
      );
      return {
        referidoId: referencia.id,
        expedienteId: referencia.expedienteId,
        expedienteNumero: referencia.expediente.numero,
        referidoEn: referencia.createdAt.toISOString(),
        referidoPor: referencia.otorgadoPor.nombreCompleto,
        motivo: referencia.motivo,
        estado,
      };
    });

    return {
      usuaria: {
        id: usuaria.id,
        nombreCompleto: nombreCompleto(usuaria),
        dpi: usuaria.dpi,
        edad: edad(usuaria),
        grupoEtnico: usuaria.grupoEtnico,
        municipio: nombreMunicipio(usuaria.municipio, usuaria.municipioOtro),
      },
      expediente: {
        id: expediente.id,
        numero: expediente.numero,
        tipoRegistro: expediente.tipoRegistro,
        enAlbergue:
          expediente.tipoRegistro === 'INTERNA' &&
          expediente.fechaEgresoAlbergue === null,
      },
      referencias: historial,
      codigoProcesoNuevo: etiquetaProcesoPsicologia(
        (expedienteTomado ?? expediente).numero,
        (expedienteTomado?.atencionesPsicologicas[0]?.consecutivo ?? 0) + 1,
        null,
      ),
      hijos: ninos.map((nino) =>
        hijoDeFicha(nino, expediente.numero, expedienteFichaTomado),
      ),
      puedeAbrirProceso:
        expedienteTomado !== null &&
        usuariaConProceso === null &&
        historial.every((referencia) => referencia.estado !== 'SIN_TOMAR'),
    };
  }
}
