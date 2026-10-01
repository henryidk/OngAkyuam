import { Prisma } from '@prisma/client';
import type { IEstadoAreasRepository } from '../interfaces/estado-areas-repository.interface';
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
export class JuridicoEstadoResolver implements IResolverEstadoArea {
  readonly area = 'JURIDICO' as const;

  constructor(private readonly repositorio: IEstadoAreasRepository) {}

  async resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea> {
    const procesos = await this.repositorio.procesosJuridicos(
      referido.expedienteId,
    );
    const abiertos = procesos.filter(
      (proceso) =>
        proceso.fase !== 'FINALIZADO' && proceso.situacion !== 'ABANDONADO',
    ).length;
    // Jurídico asigna abogada y procuradora en cada proceso, no Trabajo Social al referir.
    const profesional = null;

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
