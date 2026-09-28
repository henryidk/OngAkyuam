import type {
  PrioridadReferido,
  Rol,
  TipoDocumento,
  TipoRegistro,
} from '@prisma/client';
import type { ProfesionalArea } from '@akyuam/shared';

export const REFERIDOS_REPOSITORY = Symbol('REFERIDOS_REPOSITORY');

/** El área ya estaba referida a este expediente (`@@unique([expedienteId, area])`). */
export class AreaYaReferidaError extends Error {
  constructor() {
    super('Esta área ya fue referida a este caso');
  }
}

export interface ExpedienteParaReferir {
  id: string;
  numero: string;
  fecha: string;
  municipio: string | null;
  tipoRegistro: TipoRegistro;
  usuariaNombreCompleto: string;
  areasReferidas: Rol[];
}

export interface CrearReferidoParams {
  expedienteId: string;
  area: Rol;
  prioridad: PrioridadReferido;
  motivo: string | null;
  profesionalAsignadoId: string | null;
  puedeVerDatosCaso: boolean;
  /** Tipos cuyos documentos vigentes quedarán visibles para el área. */
  documentosVisibles: TipoDocumento[];
  /** Psicología con profesional: la atención nace ya tomada por esa psicóloga. */
  crearAtencionPsicologica: boolean;
  otorgadoPorId: string;
}

export interface ReferidoRegistrado {
  id: string;
  area: Rol;
  prioridad: PrioridadReferido;
  profesionalAsignadoId: string | null;
  createdAt: Date;
}

export interface IReferidosRepository {
  buscarExpediente(expedienteId: string): Promise<ExpedienteParaReferir | null>;
  /** `true` solo si el usuario existe, está activo y su rol es `area`. */
  esProfesionalActivoDelArea(usuarioId: string, area: Rol): Promise<boolean>;
  listarProfesionales(area: Rol): Promise<ProfesionalArea[]>;
  /**
   * Crea el referido, la visibilidad de los documentos y (si aplica) la atención psicológica en
   * una sola transacción. Lanza `AreaYaReferidaError` si el área ya estaba referida.
   */
  crear(params: CrearReferidoParams): Promise<ReferidoRegistrado>;
}
