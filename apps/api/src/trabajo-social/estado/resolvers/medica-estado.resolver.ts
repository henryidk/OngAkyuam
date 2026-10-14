import { Prisma } from '@prisma/client';
import {
  ETIQUETAS_MOTIVO_ALTA_MEDICA,
  formatFechaGT,
  formatInstanteGT,
} from '@akyuam/shared';
import type {
  AtencionMedicaParaEstado,
  IEstadoAreasRepository,
} from '../interfaces/estado-areas-repository.interface';
import type {
  IResolverEstadoArea,
  ReferidoParaEstado,
  ResultadoEstadoArea,
} from '../interfaces/resolver-estado-area.interface';

/**
 * Medicina atiende desde que Trabajo Social refiere (pendiente de primera consulta) hasta que
 * registra el alta. Si Trabajo Social vuelve a referir después de un alta, el área se reabre:
 * la referencia vigente queda pendiente hasta que se abra una atención nueva.
 */
export class MedicaEstadoResolver implements IResolverEstadoArea {
  readonly area = 'MEDICA' as const;

  constructor(private readonly repositorio: IEstadoAreasRepository) {}

  async resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea> {
    const atencion = await this.repositorio.atencionMedica(
      referido.expedienteId,
    );
    const profesional = referido.profesional;

    if (
      !atencion ||
      (atencion.estado === 'ALTA' && !atencion.posteriorAReferencia)
    ) {
      return {
        estado: 'ACTIVA',
        detalle: 'Pendiente de primera consulta',
        profesional,
      };
    }
    if (atencion.estado === 'ALTA') {
      return { estado: 'CERRADA', detalle: detalleAlta(atencion), profesional };
    }
    return { estado: 'ACTIVA', detalle: detalleActiva(atencion), profesional };
  }

  condicionActivaSql(columnaExpedienteId: Prisma.Sql): Prisma.Sql {
    // La misma regla que `resolver`: activa si no hay atención abierta desde la referencia
    // vigente (pendiente de primera consulta) o si alguna sigue activa.
    return Prisma.sql`(
      NOT EXISTS (
        SELECT 1 FROM "AtencionMedica" am
        JOIN "ReferidoArea" rm ON rm."expedienteId" = am."expedienteId" AND rm.area = 'MEDICA'
        WHERE am."expedienteId" = ${columnaExpedienteId} AND am."createdAt" >= rm."createdAt"
      )
      OR EXISTS (
        SELECT 1 FROM "AtencionMedica" am WHERE am."expedienteId" = ${columnaExpedienteId} AND am.estado = 'ACTIVA'
      )
    )`;
  }
}

function detalleActiva(atencion: AtencionMedicaParaEstado): string {
  if (atencion.citaSinRegistrar) {
    return 'Consulta sin registrar';
  }
  return atencion.proximaCita
    ? `Próxima consulta ${formatInstanteGT(atencion.proximaCita)}`
    : 'Sin consulta programada';
}

function detalleAlta(atencion: AtencionMedicaParaEstado): string {
  const motivo = atencion.motivoAlta
    ? ETIQUETAS_MOTIVO_ALTA_MEDICA[atencion.motivoAlta]
    : 'Alta';
  return atencion.fechaAlta
    ? `Alta · ${motivo} · ${formatFechaGT(atencion.fechaAlta)}`
    : `Alta · ${motivo}`;
}
