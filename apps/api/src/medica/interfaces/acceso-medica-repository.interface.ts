import type { EstadoAtencionMedica, EstadoCitaMedica } from '@akyuam/shared';

/**
 * Resuelve cada recurso de Medicina hasta su expediente, y solo si ese expediente está referido
 * a Medicina. `null` significa "no existe o no es de Medicina": el servicio responde lo mismo en
 * ambos casos.
 */
export interface AccesoExpedienteMedica {
  expedienteId: string;
  expedienteNumero: string;
  usuariaId: string;
}

export interface AccesoReferenciaMedica extends AccesoExpedienteMedica {
  referidoId: string;
}

export interface AccesoAtencionMedica extends AccesoExpedienteMedica {
  atencionId: string;
  consecutivo: number;
  estado: EstadoAtencionMedica;
  version: number;
}

export interface AccesoCitaMedica extends AccesoAtencionMedica {
  citaId: string;
  /** Personas de la visita (null = la usuaria). */
  personas: (string | null)[];
  /** Personas de la visita que ya tienen su consulta registrada. */
  personasRegistradas: (string | null)[];
  inicio: Date;
  duracionMin: number;
  estadoCita: EstadoCitaMedica;
  versionCita: number;
  reprogramadaAId: string | null;
}

export interface AccesoConsultaMedica extends AccesoAtencionMedica {
  consultaId: string;
}

export interface AccesoDocumentoMedico extends AccesoExpedienteMedica {
  documentoId: string;
  claveObjeto: string;
  nombreArchivo: string;
  mimeType: string;
}

export interface IAccesoMedicaRepository {
  buscarExpediente(
    expedienteId: string,
  ): Promise<AccesoExpedienteMedica | null>;
  buscarReferencia(referidoId: string): Promise<AccesoReferenciaMedica | null>;
  buscarAtencion(atencionId: string): Promise<AccesoAtencionMedica | null>;
  buscarCita(citaId: string): Promise<AccesoCitaMedica | null>;
  buscarConsulta(consultaId: string): Promise<AccesoConsultaMedica | null>;
  buscarDocumento(documentoId: string): Promise<AccesoDocumentoMedico | null>;
  /** La usuaria tiene al menos un expediente referido a Medicina. */
  usuariaReferida(usuariaId: string): Promise<boolean>;
  ninoPerteneceAExpediente(
    ninoId: string,
    expedienteId: string,
  ): Promise<boolean>;
}

export const ACCESO_MEDICA_REPOSITORY = Symbol('ACCESO_MEDICA_REPOSITORY');
