import type {
  DocumentoMedicoDto,
  DocumentoMedicoSubidoDto,
  TipoDocumentoMedico,
} from '@akyuam/shared';

export interface ArchivoMedicoGuardado {
  tipo: TipoDocumentoMedico;
  nombreVisible: string;
  nombreArchivo: string;
  claveObjeto: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface CrearPendienteParams extends ArchivoMedicoGuardado {
  lote: string;
  atencionId: string;
  expiraEn: Date;
}

export interface PendienteMedico {
  id: string;
  claveObjeto: string;
  atencionId: string;
}

export interface IDocumentosMedicosRepository {
  crearPendiente(
    params: CrearPendienteParams,
  ): Promise<DocumentoMedicoSubidoDto>;
  /** Solo los pendientes de quien los subió: nadie toca el lote de otra persona. */
  buscarPendiente(
    id: string,
    subidoPorId: string,
  ): Promise<PendienteMedico | null>;
  cambiarTipoPendiente(
    id: string,
    tipo: TipoDocumentoMedico,
  ): Promise<DocumentoMedicoSubidoDto>;
  eliminarPendiente(id: string): Promise<void>;
  crearEnConsulta(
    consultaId: string,
    archivo: ArchivoMedicoGuardado,
  ): Promise<DocumentoMedicoSubidoDto>;
  /** Todos los documentos de la usuaria y sus hijos/as, del más reciente al más antiguo. */
  listarPorUsuaria(usuariaId: string): Promise<DocumentoMedicoDto[]>;
  /** Pendientes que vencieron antes de `limite` (para la limpieza). */
  listarVencidos(limite: Date, cantidad: number): Promise<PendienteMedico[]>;
}

export const DOCUMENTOS_MEDICOS_REPOSITORY = Symbol(
  'DOCUMENTOS_MEDICOS_REPOSITORY',
);
