import type { ConsultaParaAgregado } from '../dominio/indicadores';
import type { ConsultaParaInforme } from '../dominio/informe-atencion';

export interface IReportesMedicaRepository {
  /**
   * Consultas con `fechaHora` en [desde, hasta], ya preparadas para agregar. Con
   * `registradaPorId`, solo las que registró esa cuenta ("Mis consultas").
   */
  consultasEntre(
    desde: Date,
    hasta: Date,
    registradaPorId?: string,
  ): Promise<ConsultaParaAgregado[]>;
  /**
   * Consultas con `fechaHora` en [desde, hasta] para el informe de atención: sexo, etnia, edad,
   * ingreso de la usuaria a Médica, si ya se le atendió antes de `desde` y su albergue.
   */
  consultasParaInforme(
    desde: Date,
    hasta: Date,
  ): Promise<ConsultaParaInforme[]>;
  /** Atenciones médicas activas hoy. */
  contarActivas(): Promise<number>;
}

export const REPORTES_MEDICA_REPOSITORY = Symbol('REPORTES_MEDICA_REPOSITORY');
