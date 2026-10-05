import type {
  FaseProcesoJuridico,
  ProcesoDetalle,
  ProcesoResumen,
  ProcesosPaginados,
  ResumenProcesos,
  SituacionProcesoJuridico,
  TipoProcesoJuridico,
} from '@akyuam/shared';

export const PROCESOS_REPOSITORY = Symbol('PROCESOS_REPOSITORY');

export interface ExpedienteAccesoJuridico {
  id: string;
  numero: string;
  usuariaId: string;
  /** La referencia de Trabajo Social que le da acceso a Jurídico (una sola por expediente). */
  referidoId: string;
  referenciaPendiente: boolean;
}

/** Lo mínimo de un proceso para autorizar y decidir una operación sobre él. */
export interface AccesoProceso {
  id: string;
  expedienteId: string;
  usuariaId: string;
  tipo: TipoProcesoJuridico;
  fase: FaseProcesoJuridico;
  situacion: SituacionProcesoJuridico;
  version: number;
  fechaInicio: string;
  abogadaId: string | null;
  procuradoraId: string | null;
}

export interface ListarProcesosParams {
  q?: string;
  /** Si viene, solo los procesos donde la ficha de personal de esa cuenta está asignada. */
  asignadosAUsuarioId?: string;
  page: number;
  pageSize: number;
}

export interface ActualizarDatosParams {
  procesoId: string;
  version: number;
  numeroJudicial: string | null;
  organoJudicial: string | null;
  contraparte: string | null;
  abogadaId: string | null;
  procuradoraId: string | null;
}

export type ResultadoActualizarDatos =
  'ACTUALIZADO' | 'CONFLICTO_VERSION' | 'PERSONAL_INEXISTENTE';

/** El detalle sin bitácora ni carpetas: esas las aportan sus propios repositorios. */
export type ProcesoDetalleBase = Omit<
  ProcesoDetalle,
  'accionesDisponibles' | 'bitacora' | 'carpetas' | 'otrosProcesosUsuaria'
>;

// Interfaz chica (ISP): lectura y datos generales de procesos. Crear, transicionar, bitácora
// y documentos viven en repositorios propios para que cada servicio dependa solo de lo que usa.
export interface IProcesosRepository {
  /** `null` tanto si el expediente no existe como si existe pero no fue referido a JURIDICO. */
  buscarExpedienteConAcceso(
    expedienteId: string,
  ): Promise<ExpedienteAccesoJuridico | null>;
  /**
   * Único punto de verificación "¿este proceso es de un expediente referido a JURIDICO?".
   * `null` tanto si no existe como si no hay acceso.
   */
  buscarAccesoProceso(procesoId: string): Promise<AccesoProceso | null>;
  listar(params: ListarProcesosParams): Promise<ProcesosPaginados>;
  resumen(): Promise<ResumenProcesos>;
  obtenerDetalleBase(procesoId: string): Promise<ProcesoDetalleBase | null>;
  /** Todos los procesos de la usuaria en expedientes referidos a JURIDICO, recientes primero. */
  listarPorUsuaria(usuariaId: string): Promise<ProcesoResumen[]>;
  actualizarDatos(
    params: ActualizarDatosParams,
  ): Promise<ResultadoActualizarDatos>;
}
