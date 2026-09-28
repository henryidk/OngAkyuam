import { Prisma } from '@prisma/client';
import type {
  IResolverEstadoArea,
  ReferidoParaEstado,
  ResultadoEstadoArea,
} from '../interfaces/resolver-estado-area.interface';

/**
 * El módulo médico todavía no define cómo se cierra una atención: mientras tanto, referida =
 * activa. Cuando exista el cierre, se reemplaza esta clase sin tocar el orquestador.
 */
export class MedicaEstadoResolver implements IResolverEstadoArea {
  readonly area = 'MEDICA' as const;

  resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea> {
    return Promise.resolve({
      estado: 'ACTIVA',
      detalle: 'Referida',
      profesional: referido.profesional,
    });
  }

  condicionActivaSql(): Prisma.Sql {
    return Prisma.sql`TRUE`;
  }
}
