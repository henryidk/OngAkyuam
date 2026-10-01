import {
  ETIQUETAS_ESTADO_VISIBLE,
  ETIQUETAS_FASE,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
} from '@akyuam/shared';
import type {
  ICompartidoRepository,
  ProcesoJuridicoCompartido,
} from '../interfaces/compartido-repository.interface';
import type { IEstrategiaCompartido } from '../interfaces/estrategia-compartido.interface';

/** Suspendido o abandonado se anuncian como tales; si no, la fase de avance. Finalizado gana. */
function etiquetaEstado(proceso: ProcesoJuridicoCompartido): string {
  if (proceso.fase !== 'FINALIZADO' && proceso.situacion !== 'ACTIVO') {
    return ETIQUETAS_ESTADO_VISIBLE[proceso.situacion];
  }
  return ETIQUETAS_FASE[proceso.fase];
}

function describirProceso(proceso: ProcesoJuridicoCompartido): string {
  const partes = [
    ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo],
    etiquetaEstado(proceso),
  ];
  if (proceso.abogada) {
    partes.push(`Abogada: ${proceso.abogada}`);
  }
  if (proceso.procuradora) {
    partes.push(`Procuradora: ${proceso.procuradora}`);
  }
  return partes.join(' · ');
}

/** Jurídico comparte cada proceso: tipo, estado (fase, o suspendido/abandonado) y quién lo lleva. Ni notas ni documentos. */
export class JuridicoCompartidoEstrategia implements IEstrategiaCompartido {
  readonly area = 'JURIDICO' as const;

  constructor(private readonly repositorio: ICompartidoRepository) {}

  async obtener(expedienteId: string): Promise<string[]> {
    const procesos = await this.repositorio.procesosJuridicos(expedienteId);
    return procesos.map(describirProceso);
  }
}
