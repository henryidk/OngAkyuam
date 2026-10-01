import type { AreaAtencion } from '@akyuam/shared';

/**
 * Qué publica un área hacia Trabajo Social sobre un caso que le fue referido, ya redactado en
 * líneas de texto. Un área nueva, o un cambio en lo que un área comparte, es una clase
 * registrada en `EstrategiasCompartido` — el service no cambia. Nunca se llama para un área no
 * referida.
 */
export interface IEstrategiaCompartido {
  readonly area: AreaAtencion;
  /** Vacío = el área todavía no ha compartido nada. */
  obtener(expedienteId: string): Promise<string[]>;
}
