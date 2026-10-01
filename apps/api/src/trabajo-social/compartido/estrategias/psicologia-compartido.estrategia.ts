import { formatInstanteGT } from '@akyuam/shared';
import type { ICompartidoRepository } from '../interfaces/compartido-repository.interface';
import type { IEstrategiaCompartido } from '../interfaces/estrategia-compartido.interface';

/**
 * Psicología comparte únicamente cuándo es la próxima cita. Nunca contenido clínico (motivo,
 * observaciones, acuerdos, temas…): esta clase ni siquiera lo recibe del repositorio.
 */
export class PsicologiaCompartidoEstrategia implements IEstrategiaCompartido {
  readonly area = 'PSICOLOGIA' as const;

  constructor(private readonly repositorio: ICompartidoRepository) {}

  async obtener(expedienteId: string): Promise<string[]> {
    const proximaCita =
      await this.repositorio.proximaCitaPsicologica(expedienteId);
    return proximaCita
      ? [`Próxima cita: ${formatInstanteGT(proximaCita)}`]
      : [];
  }
}
