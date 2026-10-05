import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  FORMAS_FINALIZACION_PROCESO,
  fechaColumnaISO,
  type FormaFinalizacionProceso,
  type ProcesoResumen,
  type ProcesosPaginados,
  type ResumenProcesos,
  type TipoProcesoJuridico,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EXPEDIENTE_REFERIDO_A_JURIDICO,
  PROCESO_CON_ACCESO,
} from '../compartido/acceso-juridico';
import { escaparLike } from '../compartido/sql';
import { codigoProceso } from '../dominio/codigo-proceso';
import { limiteInactividad } from '../dominio/estado-visible';
import type {
  AccesoProceso,
  ActualizarDatosParams,
  ExpedienteAccesoJuridico,
  IProcesosRepository,
  ListarProcesosParams,
  ProcesoDetalleBase,
  ResultadoActualizarDatos,
} from '../interfaces/procesos-repository.interface';
import { INCLUDE_RESUMEN, mapearResumen } from './mapeo-proceso';

/** Tipos de proceso cuya etiqueta en español contiene el texto buscado. */
function tiposQueCoinciden(texto: string): TipoProcesoJuridico[] {
  const buscado = texto.toLocaleLowerCase('es');
  return (
    Object.entries(ETIQUETAS_TIPO_PROCESO_JURIDICO) as [
      TipoProcesoJuridico,
      string,
    ][]
  )
    .filter(([, etiqueta]) =>
      etiqueta.toLocaleLowerCase('es').includes(buscado),
    )
    .map(([tipo]) => tipo);
}

const ACCESO_SQL = Prisma.sql`EXISTS (
  SELECT 1 FROM "ReferidoArea" r
  WHERE r."expedienteId" = p."expedienteId" AND r.area = 'JURIDICO'
)`;

const EN_TRAMITE_SQL = Prisma.sql`(p.fase <> 'FINALIZADO' AND p.situacion = 'ACTIVO')`;

function condicionesListado(params: ListarProcesosParams): Prisma.Sql {
  // La lista de trabajo solo muestra procesos en trámite.
  const condiciones: Prisma.Sql[] = [ACCESO_SQL, EN_TRAMITE_SQL];

  if (params.asignadosAUsuarioId) {
    condiciones.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Personal" pe
      WHERE pe."usuarioId" = ${params.asignadosAUsuarioId}
        AND pe.id IN (p."abogadaId", p."procuradoraId")
    )`);
  }
  if (params.q) {
    const patron = `%${escaparLike(params.q)}%`;
    const tipos = tiposQueCoinciden(params.q);
    const porTipo =
      tipos.length > 0
        ? Prisma.sql`OR p.tipo::text IN (${Prisma.join(tipos)})`
        : Prisma.empty;
    condiciones.push(Prisma.sql`(
      ('J' || p.consecutivo || '-' || e.numero) ILIKE ${patron}
      OR p."numeroJudicial" ILIKE ${patron}
      OR (u.nombres || ' ' || u.apellidos) ILIKE ${patron}
      ${porTipo}
    )`);
  }

  return Prisma.join(condiciones, ' AND ');
}

interface FilaResumen {
  referenciasPendientes: bigint;
  procesosSugeridos: bigint;
  total: bigint;
  enTramite: bigint;
  suspendidos: bigint;
  finalizados: bigint;
  abandonados: bigint;
  requierenAtencion: bigint;
  convenio: bigint;
  sentencia: bigint;
  desistimiento: bigint;
  otros: bigint;
}

@Injectable()
export class ProcesosRepository implements IProcesosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpedienteConAcceso(
    expedienteId: string,
  ): Promise<ExpedienteAccesoJuridico | null> {
    const expediente = await this.prisma.expediente.findFirst({
      where: { id: expedienteId, ...EXPEDIENTE_REFERIDO_A_JURIDICO },
      select: {
        id: true,
        numero: true,
        usuariaId: true,
        referidos: {
          where: { area: 'JURIDICO' },
          select: { id: true, atendidoEn: true, devueltoEn: true },
        },
      },
    });
    const referencia = expediente?.referidos[0];
    if (!expediente || !referencia) {
      return null;
    }
    return {
      id: expediente.id,
      numero: expediente.numero,
      usuariaId: expediente.usuariaId,
      referidoId: referencia.id,
      referenciaPendiente: !referencia.atendidoEn && !referencia.devueltoEn,
    };
  }

  async buscarAccesoProceso(procesoId: string): Promise<AccesoProceso | null> {
    const proceso = await this.prisma.procesoJuridico.findFirst({
      where: { id: procesoId, ...PROCESO_CON_ACCESO },
      select: {
        id: true,
        expedienteId: true,
        tipo: true,
        fase: true,
        situacion: true,
        version: true,
        fechaInicio: true,
        abogadaId: true,
        procuradoraId: true,
        expediente: { select: { usuariaId: true } },
      },
    });
    if (!proceso) {
      return null;
    }
    const { expediente, fechaInicio, ...resto } = proceso;
    return {
      ...resto,
      usuariaId: expediente.usuariaId,
      fechaInicio: fechaColumnaISO(fechaInicio),
    };
  }

  async listar(params: ListarProcesosParams): Promise<ProcesosPaginados> {
    const condiciones = condicionesListado(params);
    const desde = Prisma.sql`
      FROM "ProcesoJuridico" p
      JOIN "Expediente" e ON e.id = p."expedienteId"
      JOIN "Usuaria" u ON u.id = e."usuariaId"
      WHERE ${condiciones}
    `;

    // Filtro, orden y paginación en la base (el código "J2-05-2026" no es una columna, así
    // que la búsqueda necesita SQL); los datos de cada fila se cargan después por id.
    const [filas, conteo] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id ${desde}
        ORDER BY p."createdAt" DESC, p.id
        LIMIT ${params.pageSize} OFFSET ${(params.page - 1) * params.pageSize}
      `),
      this.prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT count(*) AS total ${desde}`,
      ),
    ]);

    const ids = filas.map((fila) => fila.id);
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: { id: { in: ids } },
      include: INCLUDE_RESUMEN,
    });
    const porId = new Map(procesos.map((proceso) => [proceso.id, proceso]));
    const ahora = new Date();

    return {
      items: ids.flatMap((id) => {
        const proceso = porId.get(id);
        return proceso ? [mapearResumen(proceso, ahora)] : [];
      }),
      page: params.page,
      pageSize: params.pageSize,
      total: Number(conteo[0]?.total ?? 0),
    };
  }

  async resumen(): Promise<ResumenProcesos> {
    // Todos los contadores en una sola pasada (count FILTER), nunca una consulta por tarjeta.
    const [fila] = await this.prisma.$queryRaw<FilaResumen[]>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM "ReferidoArea" r
          WHERE r.area = 'JURIDICO' AND r."atendidoEn" IS NULL AND r."devueltoEn" IS NULL
        ) AS "referenciasPendientes",
        (SELECT coalesce(sum(cardinality(r."procesosSugeridos")), 0) FROM "ReferidoArea" r
          WHERE r.area = 'JURIDICO' AND r."atendidoEn" IS NULL AND r."devueltoEn" IS NULL
        ) AS "procesosSugeridos",
        count(*) AS total,
        count(*) FILTER (WHERE ${EN_TRAMITE_SQL}) AS "enTramite",
        count(*) FILTER (WHERE p.fase <> 'FINALIZADO' AND p.situacion = 'SUSPENDIDO') AS suspendidos,
        count(*) FILTER (WHERE p.fase = 'FINALIZADO') AS finalizados,
        count(*) FILTER (WHERE p.fase <> 'FINALIZADO' AND p.situacion = 'ABANDONADO') AS abandonados,
        count(*) FILTER (
          WHERE ${EN_TRAMITE_SQL} AND p."ultimaActuacionEn" < ${limiteInactividad()}
        ) AS "requierenAtencion",
        count(*) FILTER (WHERE p."formaFinalizacion" = 'CONVENIO') AS convenio,
        count(*) FILTER (WHERE p."formaFinalizacion" = 'SENTENCIA') AS sentencia,
        count(*) FILTER (WHERE p."formaFinalizacion" = 'DESISTIMIENTO') AS desistimiento,
        count(*) FILTER (WHERE p."formaFinalizacion" = 'OTROS') AS otros
      FROM "ProcesoJuridico" p
      WHERE ${ACCESO_SQL}
    `);

    const porForma: Record<FormaFinalizacionProceso, bigint> = {
      CONVENIO: fila.convenio,
      SENTENCIA: fila.sentencia,
      DESISTIMIENTO: fila.desistimiento,
      OTROS: fila.otros,
    };

    return {
      referenciasPendientes: Number(fila.referenciasPendientes),
      procesosSugeridos: Number(fila.procesosSugeridos),
      total: Number(fila.total),
      enTramite: Number(fila.enTramite),
      suspendidos: Number(fila.suspendidos),
      finalizados: Number(fila.finalizados),
      finalizadosPorForma: Object.fromEntries(
        FORMAS_FINALIZACION_PROCESO.map((forma) => [
          forma,
          Number(porForma[forma]),
        ]),
      ) as Record<FormaFinalizacionProceso, number>,
      abandonados: Number(fila.abandonados),
      requierenAtencion: Number(fila.requierenAtencion),
    };
  }

  async obtenerDetalleBase(
    procesoId: string,
  ): Promise<ProcesoDetalleBase | null> {
    const proceso = await this.prisma.procesoJuridico.findFirst({
      where: { id: procesoId, ...PROCESO_CON_ACCESO },
      include: {
        ...INCLUDE_RESUMEN,
        procesoOrigen: {
          select: {
            id: true,
            consecutivo: true,
            tipo: true,
            expediente: { select: { numero: true } },
          },
        },
        abandonos: { where: { reactivadoEn: null }, take: 1 },
        suspensiones: { where: { hasta: null }, take: 1 },
      },
    });
    if (!proceso) {
      return null;
    }

    // Vigente solo cuenta si la situación lo confirma: un proceso migrado como finalizado
    // puede conservar su fila de abandono como historial.
    const abandono =
      proceso.situacion === 'ABANDONADO' ? proceso.abandonos[0] : undefined;
    const suspension =
      proceso.situacion === 'SUSPENDIDO' ? proceso.suspensiones[0] : undefined;

    return {
      ...mapearResumen(proceso),
      organoJudicial: proceso.organoJudicial,
      contraparte: proceso.contraparte,
      procesoOrigen: proceso.procesoOrigen
        ? {
            id: proceso.procesoOrigen.id,
            codigo: codigoProceso(
              proceso.procesoOrigen.consecutivo,
              proceso.procesoOrigen.expediente.numero,
            ),
            tipo: proceso.procesoOrigen.tipo,
          }
        : null,
      abandonoVigente: abandono
        ? {
            fecha: fechaColumnaISO(abandono.fecha),
            motivoCatalogo: abandono.motivoCatalogo,
            observaciones: abandono.motivo,
            ultimoContacto: abandono.ultimoContacto
              ? fechaColumnaISO(abandono.ultimoContacto)
              : null,
            intentosContacto: abandono.intentosContacto,
            notificadoATs: abandono.notificadoATs,
          }
        : null,
      suspensionVigente: suspension
        ? { motivo: suspension.motivo, desde: suspension.desde.toISOString() }
        : null,
    };
  }

  async listarPorUsuaria(usuariaId: string): Promise<ProcesoResumen[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: {
        expediente: { usuariaId, ...EXPEDIENTE_REFERIDO_A_JURIDICO },
      },
      include: INCLUDE_RESUMEN,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const ahora = new Date();
    return procesos.map((proceso) => mapearResumen(proceso, ahora));
  }

  async actualizarDatos(
    params: ActualizarDatosParams,
  ): Promise<ResultadoActualizarDatos> {
    try {
      // La versión en el WHERE es la concurrencia optimista: si otra persona guardó antes,
      // no coincide, no se actualiza ninguna fila y nadie pisa el cambio ajeno.
      const { count } = await this.prisma.procesoJuridico.updateMany({
        where: { id: params.procesoId, version: params.version },
        data: {
          numeroJudicial: params.numeroJudicial,
          organoJudicial: params.organoJudicial,
          contraparte: params.contraparte,
          abogadaId: params.abogadaId,
          procuradoraId: params.procuradoraId,
          version: { increment: 1 },
        },
      });
      return count === 1 ? 'ACTUALIZADO' : 'CONFLICTO_VERSION';
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return 'PERSONAL_INEXISTENTE';
      }
      throw error;
    }
  }
}
