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
 * están cerrados.
 */
export class JuridicoEstadoResolver implements IResolverEstadoArea {
  readonly area = 'JURIDICO' as const;

  constructor(private readonly repositorio: IEstadoAreasRepository) {}

  async resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea> {
    const estados = await this.repositorio.estadosProcesosJuridicos(
      referido.expedienteId,
    );
    const abiertos = estados.filter((estado) => estado === 'INICIADO').length;
    // Jurídico asigna abogada y procuradora en cada proceso, no Trabajo Social al referir.
    const profesional = null;

    if (estados.length === 0) {
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
      EXISTS (SELECT 1 FROM "ProcesoJuridico" pj WHERE pj."expedienteId" = ${columnaExpedienteId} AND pj.estado = 'INICIADO')
      OR NOT EXISTS (SELECT 1 FROM "ProcesoJuridico" pj WHERE pj."expedienteId" = ${columnaExpedienteId})
    )`;
  }
}
