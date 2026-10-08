import type { RegistrarAuditoriaParams } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';

type EventoPsicologia = Required<
  Pick<RegistrarAuditoriaParams, 'accion' | 'entidad' | 'entidadId'>
> &
  Pick<RegistrarAuditoriaParams, 'detalles'>;

/**
 * Une "quién y desde dónde" con "qué pasó". En `detalles` solo van ids y valores de catálogo:
 * nunca nombres, motivos, resúmenes de cierre, notas de sesión ni nombres de archivo.
 */
export function eventoAuditoria(
  contexto: ContextoAuditoria,
  evento: EventoPsicologia,
): RegistrarAuditoriaParams {
  return {
    usuarioId: contexto.usuarioId,
    username: contexto.username,
    ipAddress: contexto.ipAddress,
    userAgent: contexto.userAgent,
    ...evento,
  };
}
