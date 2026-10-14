import type {
  ProcesoPsicologiaCompartidoDto,
  ResumenMedicoParaTs,
} from '@akyuam/shared';
import type {
  FaseProcesoJuridico,
  SituacionProcesoJuridico,
  Rol,
  TipoProcesoJuridico,
} from '@prisma/client';

export const COMPARTIDO_REPOSITORY = Symbol('COMPARTIDO_REPOSITORY');

export interface ProcesoJuridicoCompartido {
  tipo: TipoProcesoJuridico;
  fase: FaseProcesoJuridico;
  situacion: SituacionProcesoJuridico;
  abogada: string | null;
  procuradora: string | null;
}

/**
 * Lecturas mínimas de lo que cada área publica hacia Trabajo Social. Cada método selecciona
 * solo las columnas que se comparten: lo que no está aquí no puede filtrarse por descuido.
 */
export interface ICompartidoRepository {
  /** Áreas a las que se refirió el caso; `null` si el expediente no existe. */
  areasReferidas(expedienteId: string): Promise<Rol[] | null>;
  procesosJuridicos(expedienteId: string): Promise<ProcesoJuridicoCompartido[]>;
  /**
   * Procesos psicológicos del expediente que ya tienen psicóloga, del más antiguo al más
   * reciente: código, etapa, fechas, próxima cita y documentos (tipo y fecha). Nunca notas de
   * sesión, detalles de las citas ni nombres de archivo.
   */
  procesosPsicologicos(
    expedienteId: string,
  ): Promise<ProcesoPsicologiaCompartidoDto[]>;
  /**
   * Atenciones médicas del expediente, de la más antigua a la más reciente: código, estado,
   * fechas de consulta, próxima consulta y los signos vitales de la última consulta de la
   * usuaria. Nunca diagnóstico, plan, receta ni documentos.
   */
  atencionesMedicas(expedienteId: string): Promise<ResumenMedicoParaTs[]>;
}
