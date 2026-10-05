import type {
  FichaUsuariaJuridicoDto,
  FiltroUsuariasJuridico,
  ListaUsuariasJuridico,
} from '@akyuam/shared';
import type { BusquedaListaUsuarias } from '../../common/busqueda-usuarias';

export const USUARIAS_JURIDICO_REPOSITORY = Symbol(
  'USUARIAS_JURIDICO_REPOSITORY',
);

/** La ficha tal como sale de la base: los procesos y sus contadores los agrega el service. */
export type FichaUsuariaJuridico = Omit<
  FichaUsuariaJuridicoDto,
  'procesos' | 'contadores'
>;

export interface ListarUsuariasJuridicoParams {
  filtro?: FiltroUsuariasJuridico;
  busqueda?: BusquedaListaUsuarias;
  pagina: number;
  porPagina: number;
}

export interface IUsuariasJuridicoRepository {
  /** Solo usuarias con algún expediente referido a JURIDICO, paginadas: nunca toda la base. */
  listar(params: ListarUsuariasJuridicoParams): Promise<ListaUsuariasJuridico>;
  /** `null` tanto si la usuaria no existe como si ningún expediente suyo llegó a Jurídico. */
  obtenerFicha(usuariaId: string): Promise<FichaUsuariaJuridico | null>;
}
