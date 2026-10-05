import { Injectable } from '@nestjs/common';
import type {
  AreaAtencion,
  EstadoArea,
  EstadoAreaCaso,
  EstadoCasoTs,
  EstadoTs,
} from '@akyuam/shared';
import { ResolveresEstadoArea } from './resolveres-estado-area';

/** Un referido de un caso, tal como lo necesita el orquestador. */
export interface ReferidoDeCaso {
  expedienteId: string;
  area: AreaAtencion;
  profesional: string | null;
  createdAt: Date;
}

/**
 * Regla de Trabajo Social, sin conocer a ninguna área en particular: sin referidos el caso
 * está "sin referir"; si alguna área sigue activa, "en atención"; si todas cerraron, "sin
 * atención activa". La consulta de la lista replica esta misma regla en SQL
 * (`UsuariasRepository.expresionEstadoTs`).
 */
export function combinarEstadoTs(estadosAreas: EstadoArea[]): EstadoTs {
  if (estadosAreas.length === 0) {
    return 'SIN_REFERIR';
  }
  return estadosAreas.includes('ACTIVA')
    ? 'EN_ATENCION'
    : 'SIN_ATENCION_ACTIVA';
}

@Injectable()
export class EstadoTsService {
  constructor(private readonly resolveres: ResolveresEstadoArea) {}

  /** Estado de un caso a partir de sus referidos — para la ficha, no para listas (N+1). */
  async resolverCaso(referidos: ReferidoDeCaso[]): Promise<EstadoCasoTs> {
    const areas = await Promise.all(
      referidos.map((referido) => this.resolverArea(referido)),
    );
    return {
      estado: combinarEstadoTs(areas.map((area) => area.estado)),
      areas,
    };
  }

  private async resolverArea(
    referido: ReferidoDeCaso,
  ): Promise<EstadoAreaCaso> {
    const resultado = await this.resolveres.para(referido.area).resolver({
      expedienteId: referido.expedienteId,
      profesional: referido.profesional,
    });
    return {
      area: referido.area,
      estado: resultado.estado,
      detalle: resultado.detalle,
      profesional: resultado.profesional,
      referidoEn: referido.createdAt.toISOString(),
    };
  }
}
