import type {
  ProcesoActivoPorTipo,
  ProcesoCreadoDto,
  ProcesoVinculadoDto,
  TipoProcesoJuridico,
} from '@akyuam/shared';

export const REGISTRO_PROCESOS_REPOSITORY = Symbol(
  'REGISTRO_PROCESOS_REPOSITORY',
);

export interface ProcesoNuevo {
  tipo: TipoProcesoJuridico;
  abogadaId: string | null;
  procuradoraId: string | null;
  fechaInicio: string;
  procesoOrigenId: string | null;
}

export interface CrearLoteParams {
  expedienteId: string;
  numeroExpediente: string;
  /** Referencia de Trabajo Social que se atiende con este lote; `null` si no hay ninguna. */
  referidoId: string | null;
  procesos: ProcesoNuevo[];
  creadoPorId: string;
}

/** La referencia indicada no es de este expediente, no es de Jurídico o ya no está pendiente. */
export class ReferenciaNoPendienteError extends Error {
  constructor() {
    super('La referencia ya fue atendida o devuelta');
  }
}

/** Una abogada o procuradora del lote dejó de existir entre la validación y el guardado. */
export class PersonalInexistenteError extends Error {
  constructor() {
    super('La abogada o procuradora seleccionada no existe');
  }
}

export interface IRegistroProcesosRepository {
  /** Procesos sin finalizar ni abandonar de la usuaria, de los tipos dados. */
  buscarActivosPorTipo(
    usuariaId: string,
    tipos?: TipoProcesoJuridico[],
  ): Promise<ProcesoActivoPorTipo[]>;
  /** Procesos de la usuaria con los que uno nuevo se puede vincular (cualquier estado). */
  listarVinculables(usuariaId: string): Promise<ProcesoVinculadoDto[]>;
  /**
   * Crea todos los procesos del lote o ninguno, numerándolos de corrido dentro del
   * expediente. Lanza `ReferenciaNoPendienteError` o `PersonalInexistenteError`.
   */
  crearLote(params: CrearLoteParams): Promise<ProcesoCreadoDto[]>;
}
