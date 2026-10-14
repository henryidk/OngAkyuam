import {
  calcularImc,
  ETIQUETAS_ESTADO_ATENCION_MEDICA,
  fechaCalendarioGT,
  formatFechaGT,
  formatInstanteGT,
  SIGNOS_VITALES_FORMULARIO,
  type ResumenMedicoParaTs,
  type SignosVitalesDto,
} from '@akyuam/shared';
import type { ICompartidoRepository } from '../interfaces/compartido-repository.interface';
import type { IEstrategiaCompartido } from '../interfaces/estrategia-compartido.interface';

function fecha(instanteIso: string): string {
  return formatFechaGT(fechaCalendarioGT(new Date(instanteIso)));
}

function valorSigno(
  signos: SignosVitalesDto,
  clave: (typeof SIGNOS_VITALES_FORMULARIO)[number]['clave'],
): number | string | null {
  if (clave === 'presionArterial') {
    return signos.presionSistolica === null
      ? null
      : `${signos.presionSistolica}/${signos.presionDiastolica}`;
  }
  return signos[clave];
}

/** "Presión arterial 120/80 mmHg · … · IMC 24.9", con etiquetas completas y sin vacíos. */
function describirSignos(signos: SignosVitalesDto): string | null {
  const partes = SIGNOS_VITALES_FORMULARIO.flatMap(
    ({ clave, etiqueta, unidad }) => {
      const valor = valorSigno(signos, clave);
      return valor === null ? [] : [`${etiqueta} ${valor} ${unidad}`];
    },
  );
  const imc = calcularImc(signos.pesoKg, signos.tallaM);
  if (imc !== null) {
    partes.push(`Índice de masa corporal ${imc}`);
  }
  return partes.length > 0 ? partes.join(' · ') : null;
}

function describirAtencion(atencion: ResumenMedicoParaTs): string[] {
  const lineas = [
    `${atencion.codigo} · ${ETIQUETAS_ESTADO_ATENCION_MEDICA[atencion.estado]}`,
  ];
  if (atencion.fechasConsulta.length > 0) {
    lineas.push(
      `Consultas: ${atencion.fechasConsulta.map((instante) => fecha(instante)).join(', ')}`,
    );
  }
  if (atencion.proximaConsulta) {
    lineas.push(
      `Próxima consulta: ${formatInstanteGT(atencion.proximaConsulta)}`,
    );
  }
  const signos =
    atencion.signosVitales && describirSignos(atencion.signosVitales.valores);
  if (atencion.signosVitales && signos) {
    lineas.push(
      `Signos vitales (${fecha(atencion.signosVitales.fecha)}): ${signos}`,
    );
  }
  return lineas;
}

/**
 * Medicina comparte con Trabajo Social el estado y código de cada atención, las fechas de
 * consulta, la próxima y los signos vitales de la última consulta de la usuaria. Nunca el
 * diagnóstico, el plan, la receta ni los documentos: esta clase ni siquiera los recibe.
 */
export class MedicaCompartidoEstrategia implements IEstrategiaCompartido {
  readonly area = 'MEDICA' as const;

  constructor(private readonly repositorio: ICompartidoRepository) {}

  async obtener(expedienteId: string): Promise<string[]> {
    const atenciones = await this.repositorio.atencionesMedicas(expedienteId);
    return atenciones.flatMap(describirAtencion);
  }
}
