import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  edadEnAniosGT,
  fechaColumnaISO,
  nombreMunicipio,
  type EstadoReferenciaJuridico,
  type FiltroUsuariasJuridico,
  type ListaUsuariasJuridico,
} from '@akyuam/shared';
import { condicionBusqueda } from '../../common/busqueda-usuarias';
import { PrismaService } from '../../prisma/prisma.service';
import { EXPEDIENTE_REFERIDO_A_JURIDICO } from '../compartido/acceso-juridico';
import type {
  FichaUsuariaJuridico,
  IUsuariasJuridicoRepository,
  ListarUsuariasJuridicoParams,
} from '../interfaces/usuarias-repository.interface';
import { nombreCompleto } from './mapeo-proceso';

function estadoReferencia(referencia: {
  atendidoEn: Date | null;
  devueltoEn: Date | null;
}): EstadoReferenciaJuridico {
  if (referencia.devueltoEn) return 'DEVUELTA';
  if (referencia.atendidoEn) return 'ATENDIDA';
  return 'PENDIENTE';
}

type FilaListaRow = {
  usuariaId: string;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: Date;
  expedienteNumero: string;
  activos: number;
  total: number;
  abogadas: string[];
  referenciaPendiente: boolean;
  ultimaActividadEn: Date;
};

type ContadoresRow = { TODAS: number } & Record<FiltroUsuariasJuridico, number>;

/**
 * Una fila por usuaria con algún expediente referido a JURIDICO. Los procesos y referencias se
 * agregan por usuaria (no por expediente): un caso nuevo no esconde lo que ya se lleva del anterior.
 */
function cteLista(busqueda: ListarUsuariasJuridicoParams['busqueda']) {
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
        p.abogadas,
        r.pendiente AS "referenciaPendiente",
        GREATEST(r.ultima, p.ultima) AS "ultimaActividadEn"
      FROM "Usuaria" u
      -- El expediente más reciente referido a Jurídico; sin ninguno, la usuaria no aparece.
      JOIN LATERAL (
        SELECT e.numero
        FROM "Expediente" e
        JOIN "ReferidoArea" ra ON ra."expedienteId" = e.id AND ra.area = 'JURIDICO'
        WHERE e."usuariaId" = u.id
        ORDER BY e.fecha DESC, e."createdAt" DESC
        LIMIT 1
      ) ex ON TRUE
      CROSS JOIN LATERAL (
        SELECT
          max(ra."createdAt") AS ultima,
          coalesce(bool_or(ra."atendidoEn" IS NULL AND ra."devueltoEn" IS NULL), FALSE) AS pendiente
        FROM "ReferidoArea" ra
        JOIN "Expediente" e ON e.id = ra."expedienteId"
        WHERE e."usuariaId" = u.id AND ra.area = 'JURIDICO'
      ) r
      CROSS JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE pj.fase <> 'FINALIZADO' AND pj.situacion <> 'ABANDONADO')::int AS activos,
          count(*)::int AS total,
          coalesce(
            array_agg(DISTINCT pe.nombre ORDER BY pe.nombre)
              FILTER (WHERE pj.fase <> 'FINALIZADO' AND pj.situacion <> 'ABANDONADO' AND pe.nombre IS NOT NULL),
            '{}'
          ) AS abogadas,
          max(pj."ultimaActuacionEn") AS ultima
        FROM "ProcesoJuridico" pj
        JOIN "Expediente" e ON e.id = pj."expedienteId"
        LEFT JOIN "Personal" pe ON pe.id = pj."abogadaId"
        WHERE e."usuariaId" = u.id
          AND EXISTS (
            SELECT 1 FROM "ReferidoArea" ra
            WHERE ra."expedienteId" = e.id AND ra.area = 'JURIDICO'
          )
      ) p
      WHERE ${condicionBusqueda(busqueda)}
    )
  `;
}

function condicionFiltro(filtro: FiltroUsuariasJuridico | undefined) {
  switch (filtro) {
    case undefined:
      return Prisma.sql`TRUE`;
    case 'REFERENCIA_NUEVA':
      return Prisma.sql`"referenciaPendiente"`;
    case 'CON_ACTIVOS':
      return Prisma.sql`activos > 0`;
    case 'SIN_ACTIVOS':
      return Prisma.sql`NOT "referenciaPendiente" AND activos = 0`;
  }
}

@Injectable()
export class UsuariasJuridicoRepository implements IUsuariasJuridicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    params: ListarUsuariasJuridicoParams,
  ): Promise<ListaUsuariasJuridico> {
    const base = cteLista(params.busqueda);
    const filtro = condicionFiltro(params.filtro);
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
          count(*) FILTER (WHERE "referenciaPendiente")::int AS "REFERENCIA_NUEVA",
          count(*) FILTER (WHERE activos > 0)::int AS "CON_ACTIVOS",
          count(*) FILTER (WHERE NOT "referenciaPendiente" AND activos = 0)::int AS "SIN_ACTIVOS"
        FROM lista
      `),
    ]);

    return {
      filas: filas.map((fila) => ({
        usuariaId: fila.usuariaId,
        nombreCompleto: nombreCompleto(fila),
        dpi: fila.dpi,
        edad: edadEnAniosGT(fechaColumnaISO(fila.fechaNacimiento)),
        expedienteNumero: fila.expedienteNumero,
        estadoProcesos:
          fila.activos > 0
            ? 'EN_PROCESO'
            : fila.total > 0
              ? 'FINALIZADO'
              : null,
        abogadas: fila.abogadas,
        referenciaPendiente: fila.referenciaPendiente,
        ultimaActividadEn: fila.ultimaActividadEn.toISOString(),
      })),
      pagina: params.pagina,
      porPagina: params.porPagina,
      total: params.filtro ? contadores[params.filtro] : contadores.TODAS,
      contadores,
    };
  }

  async obtenerFicha(usuariaId: string): Promise<FichaUsuariaJuridico | null> {
    const usuaria = await this.prisma.usuaria.findFirst({
      where: {
        id: usuariaId,
        expedientes: { some: EXPEDIENTE_REFERIDO_A_JURIDICO },
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        dpi: true,
        fechaNacimiento: true,
        grupoEtnico: true,
        municipio: true,
        municipioOtro: true,
        expedientes: {
          where: EXPEDIENTE_REFERIDO_A_JURIDICO,
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

    const referencias = await this.prisma.referidoArea.findMany({
      where: { area: 'JURIDICO', expediente: { usuariaId } },
      select: {
        id: true,
        expedienteId: true,
        createdAt: true,
        motivo: true,
        atendidoEn: true,
        devueltoEn: true,
        motivoDevolucion: true,
        otorgadoPor: { select: { nombreCompleto: true } },
        expediente: { select: { numero: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      usuaria: {
        id: usuaria.id,
        nombreCompleto: nombreCompleto(usuaria),
        dpi: usuaria.dpi,
        edad: edadEnAniosGT(fechaColumnaISO(usuaria.fechaNacimiento)),
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
      referencias: referencias.map((referencia) => ({
        referidoId: referencia.id,
        expedienteId: referencia.expedienteId,
        expedienteNumero: referencia.expediente.numero,
        referidoEn: referencia.createdAt.toISOString(),
        referidoPor: referencia.otorgadoPor.nombreCompleto,
        motivo: referencia.motivo,
        estado: estadoReferencia(referencia),
        motivoDevolucion: referencia.motivoDevolucion,
      })),
    };
  }
}
