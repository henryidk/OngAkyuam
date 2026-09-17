import type { TipoProcesoJuridico } from '@prisma/client';
import type { ProcesoResumen, ProcesosPaginados } from '@akyuam/shared';

export const PROCESOS_JURIDICOS_REPOSITORY = Symbol(
  'PROCESOS_JURIDICOS_REPOSITORY',
);

export interface ExpedienteAccesoJuridico {
  id: string;
}

export interface AccesoProceso {
  id: string;
  expedienteId: string;
}

export interface CrearProcesoParams {
  expedienteId: string;
  tipo: TipoProcesoJuridico;
  abogadaId: string | null;
  procuradoraId: string | null;
  fechaInicio: string;
  creadoPorId: string;
}

export interface ActualizarAsignacionParams {
  procesoId: string;
  abogadaId: string | null;
  procuradoraId: string | null;
}

export interface CerrarProcesoParams {
  procesoId: string;
  fechaCierre: string;
}

export interface RegistrarAbandonoParams {
  procesoId: string;
  fecha: string;
  motivo: string | null;
  registradoPorId: string;
}

export interface ListarGlobalParams {
  estado: 'EN_CURSO' | 'FINALIZADO';
  page: number;
}

export interface IProcesosJuridicosRepository {
  /** `null` tanto si el expediente no existe como si existe pero no fue referido a JURIDICO. */
  buscarExpedienteConAcceso(
    expedienteId: string,
  ): Promise<ExpedienteAccesoJuridico | null>;
  listarPorExpediente(expedienteId: string): Promise<ProcesoResumen[]>;
  /**
   * `null` si `abogadaId`/`procuradoraId` no corresponden a un `Personal` existente
   * (violación de la FK) — nunca deja escapar el error crudo de Prisma.
   */
  crear(params: CrearProcesoParams): Promise<{ id: string } | null>;
  /**
   * Único punto de verificación "¿este proceso pertenece a un expediente referido a
   * JURIDICO?" — se reusa antes de cada operación sobre un proceso ya existente (detalle,
   * asignación, cierre, abandono, notas, documentos) para no repetir la cadena de
   * pertenencia en cada método (sin IDOR). `null` tanto si el proceso no existe como si
   * existe pero no tiene acceso — mismo criterio uniforme que `AreasRepository`.
   */
  buscarAccesoProceso(procesoId: string): Promise<AccesoProceso | null>;
  obtenerDetalle(procesoId: string): Promise<ProcesoResumen | null>;
  /** `false` si la asignación referencia un `Personal` inexistente. */
  actualizarAsignacion(params: ActualizarAsignacionParams): Promise<boolean>;
  cerrar(params: CerrarProcesoParams): Promise<void>;
  registrarAbandono(params: RegistrarAbandonoParams): Promise<void>;
  listarGlobalPaginado(params: ListarGlobalParams): Promise<ProcesosPaginados>;
}
