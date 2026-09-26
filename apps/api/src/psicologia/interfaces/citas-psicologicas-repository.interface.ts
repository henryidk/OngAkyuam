import type {
  AgendaCita,
  CitaResumen,
  DocumentoCitaDto,
  EstadoCitaPsicologica,
  ModalidadCita,
  ReportePsicologia,
} from '@akyuam/shared';

export const CITAS_PSICOLOGICAS_REPOSITORY = Symbol(
  'CITAS_PSICOLOGICAS_REPOSITORY',
);

export interface AccesoCitaPsicologica {
  id: string;
  atencionId: string;
  expedienteId: string;
}

export interface CrearCitaParams {
  atencionId: string;
  fechaHora: Date;
  modalidad: ModalidadCita;
  lugar: string | null;
  motivo: string;
  atendidoPorId: string;
}

export interface ActualizarCitaParams {
  citaId: string;
  estado: EstadoCitaPsicologica;
  observaciones: string | null;
  acuerdos: string | null;
}

export interface CrearDocumentoCitaParams {
  citaId: string;
  expedienteId: string;
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface DocumentoCitaParaDescarga {
  id: string;
  claveR2: string;
  nombreArchivo: string;
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/** Reporte agregado sin `desde`/`hasta`: esos dos campos los agrega el servicio directamente
 *  desde el string de calendario ya validado en el query, nunca recalculados a partir de un
 *  `Date` en UTC (evitaría el bug de rollover de medianoche que la disciplina de fechas del
 *  proyecto existe para evitar). */
export type ReporteAgregado = Omit<ReportePsicologia, 'desde' | 'hasta'>;

export interface ICitasPsicologicasRepository {
  /**
   * Único punto de verificación "¿esta cita pertenece a una atención de un expediente
   * referido a PSICOLOGIA?" — se reusa antes de cada operación sobre una cita ya existente.
   * `null` tanto si la cita no existe como si existe pero no tiene acceso (sin IDOR).
   */
  buscarAccesoCita(citaId: string): Promise<AccesoCitaPsicologica | null>;
  crear(params: CrearCitaParams): Promise<CitaResumen>;
  actualizar(params: ActualizarCitaParams): Promise<CitaResumen>;
  crearDocumento(params: CrearDocumentoCitaParams): Promise<DocumentoCitaDto>;
  /** `null` tanto si la cita no tiene documento todavía como si no le pertenece. */
  buscarDocumentoParaDescarga(
    citaId: string,
  ): Promise<DocumentoCitaParaDescarga | null>;
  listarAgenda(rango: RangoFechas): Promise<AgendaCita[]>;
  obtenerReporte(rango: RangoFechas): Promise<ReporteAgregado>;
}
