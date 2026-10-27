import type {
  FichaUsuariaPsicologiaDto,
  FiltroUsuariasPsicologia,
  ListaUsuariasPsicologia,
} from '@akyuam/shared';
import type { BusquedaListaUsuarias } from '../../common/busqueda-usuarias';

export const USUARIAS_PSICOLOGIA_REPOSITORY = Symbol(
  'USUARIAS_PSICOLOGIA_REPOSITORY',
);

export interface ListarUsuariasPsicologiaParams {
  psicologaId: string;
  filtro?: FiltroUsuariasPsicologia;
  busqueda?: BusquedaListaUsuarias;
  pagina: number;
  porPagina: number;
}

/**
 * La ficha sin los procesos (salen de `IConsultasProcesosRepository`) ni lo que comparte
 * Medicina (sale de `IVisibilidadMedicaReader`).
 */
export type FichaUsuariaRepo = Omit<
  FichaUsuariaPsicologiaDto,
  'procesos' | 'procesosDeColegas' | 'contadores' | 'medicina'
>;

/**
 * Usuarias que una psicóloga puede ver: las referidas a Psicología que nadie ha tomado y las
 * que ella atiende o atendió. De las que lleva otra psicóloga no sale nada.
 */
export interface IUsuariasPsicologiaRepository {
  listar(
    params: ListarUsuariasPsicologiaParams,
  ): Promise<ListaUsuariasPsicologia>;
  /**
   * `null` tanto si la usuaria no existe como si esta psicóloga no puede verla. `ahora` decide
   * cuál es la próxima sesión de cada hijo/a.
   */
  obtenerFicha(
    usuariaId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<FichaUsuariaRepo | null>;
}
