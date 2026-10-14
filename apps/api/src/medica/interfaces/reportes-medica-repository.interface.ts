import type { ConsultaParaAgregado } from '../dominio/indicadores';

export interface IReportesMedicaRepository {
  /** Consultas con `fechaHora` en [desde, hasta], ya preparadas para agregar. */
  consultasEntre(desde: Date, hasta: Date): Promise<ConsultaParaAgregado[]>;
  /** Atenciones médicas activas hoy. */
  contarActivas(): Promise<number>;
  /** Instante de la primera consulta registrada, para la lista de años. */
  primeraConsulta(): Promise<Date | null>;
}

export const REPORTES_MEDICA_REPOSITORY = Symbol('REPORTES_MEDICA_REPOSITORY');
