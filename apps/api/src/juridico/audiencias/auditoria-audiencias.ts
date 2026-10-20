import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';

// Auditoría de las escrituras de audiencias. En `detalles` solo ids y valores de catálogo:
// nunca motivos, observaciones, descripción ni el No. judicial.

export function auditarAudiencia(
  auditService: AuditService,
  contexto: ContextoAuditoria,
  accion: string,
  audienciaId: string,
  detalles: Record<string, string>,
): Promise<void> {
  return auditService.registrar(
    eventoAuditoria(contexto, {
      accion,
      entidad: 'AudienciaJuridica',
      entidadId: audienciaId,
      detalles,
    }),
  );
}

/** El No. judicial capturado de paso al agendar o registrar el resultado cambia el proceso. */
export async function auditarNumeroJudicial(
  auditService: AuditService,
  contexto: ContextoAuditoria,
  procesoId: string,
  asignado: boolean,
): Promise<void> {
  if (!asignado) {
    return;
  }
  await auditService.registrar(
    eventoAuditoria(contexto, {
      accion: 'PROCESO_NUMERO_JUDICIAL',
      entidad: 'ProcesoJuridico',
      entidadId: procesoId,
    }),
  );
}
