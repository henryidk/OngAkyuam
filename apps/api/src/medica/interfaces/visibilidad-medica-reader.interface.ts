import type {
  VistaMedicaParaJuridico,
  VistaMedicaParaPsicologia,
} from '@akyuam/shared';

export const VISIBILIDAD_MEDICA_READER = Symbol('VISIBILIDAD_MEDICA_READER');

/** Lo mínimo para firmar la URL de una constancia: nunca se devuelve al navegador. */
export interface ConstanciaMedicaParaFirmar {
  documentoId: string;
  expedienteId: string;
  claveObjeto: string;
  nombreArchivo: string;
  mimeType: string;
}

/**
 * Lo que Medicina comparte con otras áreas, según la visibilidad que la médica activó en cada
 * atención. Jurídico y Psicología dependen de esta interfaz, nunca de los repositorios de
 * Medicina. Cada método filtra además por la referencia al área que lee: una atención visible
 * para Jurídico no aparece en un expediente que Trabajo Social no refirió a Jurídico.
 */
export interface IVisibilidadMedicaReader {
  /** Fechas de consulta y constancias de las atenciones con `visibleJuridico`. */
  paraJuridico(usuariaId: string): Promise<VistaMedicaParaJuridico[]>;
  /** La constancia, solo si es `CONSTANCIA`, de esa usuaria y de una atención visible para Jurídico. */
  constanciaParaJuridico(
    usuariaId: string,
    documentoId: string,
  ): Promise<ConstanciaMedicaParaFirmar | null>;
  /** Fechas de consulta de las atenciones con `visiblePsicologia`. */
  paraPsicologia(usuariaId: string): Promise<VistaMedicaParaPsicologia[]>;
}
