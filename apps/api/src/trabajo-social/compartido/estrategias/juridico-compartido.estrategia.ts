import {
  ETIQUETAS_ESTADO_PROCESO_JURIDICO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
} from '@akyuam/shared';
import type {
  ICompartidoRepository,
  ProcesoJuridicoCompartido,
} from '../interfaces/compartido-repository.interface';
import type { IEstrategiaCompartido } from '../interfaces/estrategia-compartido.interface';

function describirProceso(proceso: ProcesoJuridicoCompartido): string {
  const partes = [
    ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo],
    ETIQUETAS_ESTADO_PROCESO_JURIDICO[proceso.estado],
  ];
  if (proceso.abogada) {
    partes.push(`Abogada: ${proceso.abogada}`);
  }
  if (proceso.procuradora) {
    partes.push(`Procuradora: ${proceso.procuradora}`);
  }
  return partes.join(' · ');
}

/** Jurídico comparte cada proceso: tipo, estado y quién lo lleva. Ni notas ni documentos. */
export class JuridicoCompartidoEstrategia implements IEstrategiaCompartido {
  readonly area = 'JURIDICO' as const;

  constructor(private readonly repositorio: ICompartidoRepository) {}

  async obtener(expedienteId: string): Promise<string[]> {
    const procesos = await this.repositorio.procesosJuridicos(expedienteId);
    return procesos.map(describirProceso);
  }
}
