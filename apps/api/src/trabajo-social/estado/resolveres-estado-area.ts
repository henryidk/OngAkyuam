import { Inject, Injectable } from '@nestjs/common';
import type { AreaAtencion } from '@akyuam/shared';
import { ESTADO_AREAS_REPOSITORY } from './interfaces/estado-areas-repository.interface';
import type { IEstadoAreasRepository } from './interfaces/estado-areas-repository.interface';
import type { IResolverEstadoArea } from './interfaces/resolver-estado-area.interface';
import { JuridicoEstadoResolver } from './resolvers/juridico-estado.resolver';
import { MedicaEstadoResolver } from './resolvers/medica-estado.resolver';
import { PsicologiaEstadoResolver } from './resolvers/psicologia-estado.resolver';

/** Una estrategia de estado por área de atención — mismo patrón que `PoliticasAcceso`. */
@Injectable()
export class ResolveresEstadoArea {
  private readonly resolveres: Record<AreaAtencion, IResolverEstadoArea>;

  constructor(
    @Inject(ESTADO_AREAS_REPOSITORY)
    repositorio: IEstadoAreasRepository,
  ) {
    this.resolveres = {
      JURIDICO: new JuridicoEstadoResolver(repositorio),
      PSICOLOGIA: new PsicologiaEstadoResolver(repositorio),
      MEDICA: new MedicaEstadoResolver(),
    };
  }

  para(area: AreaAtencion): IResolverEstadoArea {
    return this.resolveres[area];
  }

  todos(): IResolverEstadoArea[] {
    return Object.values(this.resolveres);
  }
}
