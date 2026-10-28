import type { RegistrarAuditoriaParams } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';

type EventoMedica = Required<
  Pick<RegistrarAuditoriaParams, 'accion' | 'entidad' | 'entidadId'>
> &
  Pick<RegistrarAuditoriaParams, 'detalles'>;

/** Una búsqueda o una lista no apunta a una sola entidad: no lleva `entidadId`. */
type BusquedaMedica = Required<
  Pick<RegistrarAuditoriaParams, 'accion' | 'entidad'>
> &
  Pick<RegistrarAuditoriaParams, 'detalles'>;

/**
 * Une "quién y desde dónde" con "qué pasó". En `detalles` solo van ids y valores de catálogo:
 * nunca nombres, diagnósticos, valores de signos vitales, notas ni nombres de archivo.
 */
export function eventoAuditoria(
  contexto: ContextoAuditoria,
  evento: EventoMedica,
): RegistrarAuditoriaParams {
  return {
    usuarioId: contexto.usuarioId,
    username: contexto.username,
    ipAddress: contexto.ipAddress,
    userAgent: contexto.userAgent,
    ...evento,
  };
}

/** Lo mismo para una búsqueda. Nunca se guarda el texto buscado: puede ser un nombre. */
export function eventoBusquedaAuditoria(
  contexto: ContextoAuditoria,
  evento: BusquedaMedica,
): RegistrarAuditoriaParams {
  return {
    usuarioId: contexto.usuarioId,
    username: contexto.username,
    ipAddress: contexto.ipAddress,
    userAgent: contexto.userAgent,
    ...evento,
  };
}
