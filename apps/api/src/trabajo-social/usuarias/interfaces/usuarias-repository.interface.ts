import type { GrupoEtnico, MunicipioAltaVerapaz } from '@prisma/client';
import type {
  AreaAtencion,
  FiltroListaUsuarias,
  ListaUsuariasTs,
  PrioridadReferido,
  TipoRegistro,
  UsuariaExpedienteHub,
  UsuariaResumenBusqueda,
} from '@akyuam/shared';

export const USUARIAS_REPOSITORY = Symbol('USUARIAS_REPOSITORY');

export interface DatosIdentidadUsuariaParams {
  nombres: string;
  apellidos: string;
  dpi: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string;
  grupoEtnico: GrupoEtnico;
  municipio: MunicipioAltaVerapaz | null;
  departamentoOtro: string | null;
  municipioOtro: string | null;
  ubicacionGeografica: string | null;
}

/** Criterio de búsqueda de la lista, ya interpretado por el service a partir de `q`. */
export type BusquedaListaUsuarias =
  | { tipo: 'numeroExpediente'; valor: string }
  | { tipo: 'dpi'; valor: string }
  | { tipo: 'nombre'; valor: string };

export interface ListarUsuariasParams {
  filtro?: FiltroListaUsuarias;
  busqueda?: BusquedaListaUsuarias;
  pagina: number;
  porPagina: number;
}

export interface ReferidoCasoRow {
  area: AreaAtencion;
  prioridad: PrioridadReferido;
  profesional: string | null;
  createdAt: Date;
}

export interface CasoHubRow {
  id: string;
  numero: string;
  fecha: string;
  tipoRegistro: TipoRegistro;
  enAlbergue: boolean;
  referidos: ReferidoCasoRow[];
}

/** El hub tal como sale de la base: el estado derivado lo agrega el service. */
export type UsuariaHubRow = Omit<
  UsuariaExpedienteHub,
  'casos' | 'casoActivo'
> & {
  /** Más reciente primero — el primero es el caso activo. */
  casos: CasoHubRow[];
};

export interface IUsuariasRepository {
  /** Estado de cada fila calculado en la misma consulta (sin N+1), ver `ResolveresEstadoArea`. */
  listar(params: ListarUsuariasParams): Promise<ListaUsuariasTs>;
  buscarPorDpi(dpi: string): Promise<UsuariaResumenBusqueda | null>;
  /** Búsqueda difusa por nombre completo vía el índice trigram ya existente (RF-08). */
  buscarPorNombre(
    nombre: string,
    limite: number,
  ): Promise<UsuariaResumenBusqueda[]>;
  obtenerHub(id: string): Promise<UsuariaHubRow | null>;
  existeDpi(dpi: string, excluirId?: string): Promise<boolean>;
  /** `null` si el id no corresponde a una `Usuaria` existente. */
  actualizarIdentidad(
    id: string,
    datos: DatosIdentidadUsuariaParams,
  ): Promise<UsuariaHubRow | null>;
}
