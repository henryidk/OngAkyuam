export const TRABAJO_SOCIAL_NOTIFIER = Symbol('TRABAJO_SOCIAL_NOTIFIER');

/** Avisa a Trabajo Social que algo de su bandeja cambió — mismo desacople que `IAreaNotifier`. */
export interface ITrabajoSocialNotifier {
  notificarCambioBandeja(): void;
}
