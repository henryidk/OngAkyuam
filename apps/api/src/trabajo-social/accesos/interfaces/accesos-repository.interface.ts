import type { Rol, TipoDocumento, TipoRegistro } from '@prisma/client';

export const ACCESOS_REPOSITORY = Symbol('ACCESOS_REPOSITORY');

export interface ReferidoParaAccesos {
  area: Rol;
  puedeVerDatosCaso: boolean;
}

export interface DocumentoParaAccesos {
  id: string;
  tipo: TipoDocumento;
  version: number;
  areasVisibles: Rol[];
}

export interface ExpedienteParaAccesos {
  id: string;
  numero: string;
  tipoRegistro: TipoRegistro;
  referidos: ReferidoParaAccesos[];
  /** Solo documentos vigentes de los formularios de Trabajo Social. */
  documentos: DocumentoParaAccesos[];
}

export interface ActualizarAccesoParams {
  expedienteId: string;
  area: Rol;
  datosCaso?: boolean;
  documentos: { documentoId: string; visible: boolean }[];
  otorgadoPorId: string;
}

export interface IAccesosRepository {
  buscarExpediente(expedienteId: string): Promise<ExpedienteParaAccesos | null>;
  /** Aplica todos los cambios en una sola transacción. */
  actualizar(params: ActualizarAccesoParams): Promise<void>;
}
