import { Injectable } from '@nestjs/common';
import type { AreaAtencion } from '@akyuam/shared';
import type { IPoliticaAccesoArea } from './politica-acceso-area.interface';
import { PoliticaJuridico } from './politica-juridico';
import { PoliticaRestringible } from './politica-restringible';

/**
 * Una política por área de atención. Un área nueva (o un cambio de reglas de una existente) se
 * agrega aquí sin tocar a quien consulta la política.
 */
@Injectable()
export class PoliticasAcceso {
  private readonly politicas: Record<AreaAtencion, IPoliticaAccesoArea> = {
    JURIDICO: new PoliticaJuridico(),
    PSICOLOGIA: new PoliticaRestringible('PSICOLOGIA'),
    MEDICA: new PoliticaRestringible('MEDICA'),
  };

  para(area: AreaAtencion): IPoliticaAccesoArea {
    return this.politicas[area];
  }
}
