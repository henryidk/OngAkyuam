import type { IEstrategiaCompartido } from '../interfaces/estrategia-compartido.interface';

/**
 * El módulo médico todavía no registra citas: no hay nada que compartir. Cuando existan, se
 * reemplaza esta clase (próxima cita, igual que Psicología) sin tocar el service.
 */
// TODO(ONG): confirmar qué comparte Médica con Trabajo Social además de la próxima cita.
export class MedicaCompartidoEstrategia implements IEstrategiaCompartido {
  readonly area = 'MEDICA' as const;

  obtener(): Promise<string[]> {
    return Promise.resolve([]);
  }
}
