import {
  ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA,
  ETIQUETAS_TIPO_DOCUMENTO,
  fechaCalendarioGT,
  formatFechaGT,
  formatInstanteGT,
  type ProcesoPsicologiaCompartidoDto,
} from '@akyuam/shared';
import type { ICompartidoRepository } from '../interfaces/compartido-repository.interface';
import type { IEstrategiaCompartido } from '../interfaces/estrategia-compartido.interface';

function fecha(instanteIso: string): string {
  return formatFechaGT(fechaCalendarioGT(new Date(instanteIso)));
}

function describirProceso(proceso: ProcesoPsicologiaCompartidoDto): string[] {
  const encabezado = [
    proceso.codigo,
    ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[proceso.etapa],
    proceso.fechaInicio
      ? `Inicio: ${fecha(proceso.fechaInicio)}`
      : 'Primera cita por agendar',
  ];
  if (proceso.fechaCierre) {
    encabezado.push(`Cierre: ${fecha(proceso.fechaCierre)}`);
  }

  const lineas = [encabezado.join(' · ')];
  if (proceso.proximaCita) {
    lineas.push(`Próxima cita: ${formatInstanteGT(proceso.proximaCita)}`);
  }
  for (const documento of proceso.documentos) {
    lineas.push(
      `Documento: ${ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]} (${fecha(documento.subidoEn)})`,
    );
  }
  return lineas;
}

/**
 * Psicología comparte siempre con Trabajo Social lo superficial de cada proceso: código, etapa,
 * fechas, próxima cita y qué documentos se subieron. Nunca notas de sesión ni detalles de las
 * citas: esta clase ni siquiera los recibe del repositorio.
 */
export class PsicologiaCompartidoEstrategia implements IEstrategiaCompartido {
  readonly area = 'PSICOLOGIA' as const;

  constructor(private readonly repositorio: ICompartidoRepository) {}

  async obtener(expedienteId: string): Promise<string[]> {
    const procesos = await this.repositorio.procesosPsicologicos(expedienteId);
    return procesos.flatMap(describirProceso);
  }
}
