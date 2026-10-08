import { Prisma } from '@prisma/client';
import { formatInstanteGT } from '@akyuam/shared';
import type { IEstadoAreasRepository } from '../interfaces/estado-areas-repository.interface';
import type {
  IResolverEstadoArea,
  ReferidoParaEstado,
  ResultadoEstadoArea,
} from '../interfaces/resolver-estado-area.interface';

/**
 * Psicología atiende hasta que registra el cierre del proceso clínico. Sin `AtencionPsicologica`
 * el caso está en la cola "Referencias sin tomar" del área: eso también cuenta como en atención.
 */
export class PsicologiaEstadoResolver implements IResolverEstadoArea {
  readonly area = 'PSICOLOGIA' as const;

  constructor(private readonly repositorio: IEstadoAreasRepository) {}

  async resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea> {
    const atencion = await this.repositorio.atencionPsicologica(
      referido.expedienteId,
    );
    const profesional = atencion?.psicologa ?? referido.profesional;

    if (atencion?.estado === 'CIERRE') {
      return { estado: 'CERRADA', detalle: 'Atención cerrada', profesional };
    }
    if (!atencion?.psicologa) {
      return {
        estado: 'ACTIVA',
        detalle: 'En cola · sin psicóloga asignada',
        profesional,
      };
    }
    return {
      estado: 'ACTIVA',
      detalle: atencion.proximaCita
        ? `Próxima cita ${formatInstanteGT(atencion.proximaCita)}`
        : 'Sin cita programada',
      profesional,
    };
  }

  condicionActivaSql(columnaExpedienteId: Prisma.Sql): Prisma.Sql {
    // Activa si aún no tiene procesos (en cola) o si alguno sigue sin cerrar; la base garantiza
    // que el que no está cerrado es siempre el más reciente.
    return Prisma.sql`(
      NOT EXISTS (
        SELECT 1 FROM "AtencionPsicologica" ap WHERE ap."expedienteId" = ${columnaExpedienteId}
      )
      OR EXISTS (
        SELECT 1 FROM "AtencionPsicologica" ap WHERE ap."expedienteId" = ${columnaExpedienteId} AND ap.estado <> 'CIERRE'
      )
    )`;
  }
}
