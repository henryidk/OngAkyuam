import type { Rol } from '@prisma/client';
import type { ExpedienteResumenArea } from '@akyuam/shared';

export const AREA_NOTIFIER = Symbol('AREA_NOTIFIER');

/**
 * Abstrae "avisar a un área que se le refirió un caso" del mecanismo real (WebSocket) —
 * ExpedientesService (módulo trabajo-social) depende de esta interfaz, nunca de la
 * clase concreta AreasGateway, que es un detalle de infraestructura del módulo areas.
 */
export interface IAreaNotifier {
  notificarReferido(area: Rol, resumen: ExpedienteResumenArea): void;
  /** Los datos personales de la usuaria de ese expediente cambiaron: el área vuelve a pedirlos. */
  notificarUsuariaActualizada(area: Rol, expedienteId: string): void;
}
