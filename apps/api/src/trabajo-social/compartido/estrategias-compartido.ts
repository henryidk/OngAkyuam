import { Inject, Injectable } from '@nestjs/common';
import type { AreaAtencion } from '@akyuam/shared';
import { JuridicoCompartidoEstrategia } from './estrategias/juridico-compartido.estrategia';
import { MedicaCompartidoEstrategia } from './estrategias/medica-compartido.estrategia';
import { PsicologiaCompartidoEstrategia } from './estrategias/psicologia-compartido.estrategia';
import { COMPARTIDO_REPOSITORY } from './interfaces/compartido-repository.interface';
import type { ICompartidoRepository } from './interfaces/compartido-repository.interface';
import type { IEstrategiaCompartido } from './interfaces/estrategia-compartido.interface';

/** Una estrategia de "compartido" por área de atención — mismo patrón que `ResolveresEstadoArea`. */
@Injectable()
export class EstrategiasCompartido {
  private readonly estrategias: Record<AreaAtencion, IEstrategiaCompartido>;

  constructor(
    @Inject(COMPARTIDO_REPOSITORY)
    repositorio: ICompartidoRepository,
  ) {
    this.estrategias = {
      JURIDICO: new JuridicoCompartidoEstrategia(repositorio),
      PSICOLOGIA: new PsicologiaCompartidoEstrategia(repositorio),
      MEDICA: new MedicaCompartidoEstrategia(),
    };
  }

  para(area: AreaAtencion): IEstrategiaCompartido {
    return this.estrategias[area];
  }
}
