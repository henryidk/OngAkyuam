import { Prisma } from '@prisma/client';
import { formatearResponsable } from '@akyuam/shared';
import type {
  IEstadoAreasRepository,
  ProcesoJuridicoParaEstado,
} from '../interfaces/estado-areas-repository.interface';
import type {
  IResolverEstadoArea,
  ReferidoParaEstado,
  ResultadoEstadoArea,
} from '../interfaces/resolver-estado-area.interface';

/**
 * Jurídico sigue atendiendo mientras tenga algún proceso abierto, o si todavía no abrió
 * ninguno (recién referida: la usuaria está en su bandeja). Cierra cuando todos sus procesos
 * están finalizados o abandonados. Un proceso suspendido sigue contando como abierto (es una
 * pausa, Jurídico aún lleva el caso); uno abandonado no, y vuelve a contar si se reactiva.
 */
function abierto(proceso: ProcesoJuridicoParaEstado): boolean {
  return proceso.fase !== 'FINALIZADO' && proceso.situacion !== 'ABANDONADO';
}

export class JuridicoEstadoResolver implements IResolverEstadoArea {
  readonly area = 'JURIDICO' as const;

  constructor(private readonly repositorio: IEstadoAreasRepository) {}

  async resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea> {
    const procesos = await this.repositorio.procesosJuridicos(
      referido.expedienteId,
    );
    const abiertos = procesos.filter(abierto).length;
    // Jurídico asigna la abogada en cada proceso, no Trabajo Social al referir: se muestran las
    // de los procesos abiertos (o, con todo cerrado, las que los llevaron), sin repetir.
    const vigentes = abiertos > 0 ? procesos.filter(abierto) : procesos;
    const abogadas = [
      ...new Set(
        vigentes.flatMap((proceso) =>
          proceso.abogada
            ? [formatearResponsable(proceso.abogada, 'abogada')]
            : [],
        ),
      ),
    ];
    const profesional = abogadas.length > 0 ? abogadas.join(', ') : null;

    if (procesos.length === 0) {
      return {
        estado: 'ACTIVA',
        detalle: 'Sin procesos abiertos todavía',
        profesional,
      };
    }
    if (abiertos > 0) {
      return {
        estado: 'ACTIVA',
        detalle:
          abiertos === 1 ? '1 proceso activo' : `${abiertos} procesos activos`,
        profesional,
      };
    }
    return { estado: 'CERRADA', detalle: 'Procesos cerrados', profesional };
  }

  condicionActivaSql(columnaExpedienteId: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`(
      EXISTS (SELECT 1 FROM "ProcesoJuridico" pj WHERE pj."expedienteId" = ${columnaExpedienteId} AND pj.fase <> 'FINALIZADO' AND pj.situacion <> 'ABANDONADO')
      OR NOT EXISTS (SELECT 1 FROM "ProcesoJuridico" pj WHERE pj."expedienteId" = ${columnaExpedienteId})
    )`;
  }
}
