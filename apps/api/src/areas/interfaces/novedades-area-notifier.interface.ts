import type { Rol } from '@prisma/client';

export const NOVEDADES_AREA_NOTIFIER = Symbol('NOVEDADES_AREA_NOTIFIER');

/**
 * Avisa a un área que cambió algo de lo que le muestra su Inicio (referencias, datos o documentos
 * de Trabajo Social). Interfaz aparte de `IAreaNotifier`: quien solo necesita este aviso no
 * depende de los demás.
 */
export interface INovedadesAreaNotifier {
  notificarNovedades(area: Rol): void;
}
