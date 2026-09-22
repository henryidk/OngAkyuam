import type { GrupoEtnico, MunicipioAltaVerapaz } from '@prisma/client';
import type {
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

export interface IUsuariasRepository {
  buscarPorDpi(dpi: string): Promise<UsuariaResumenBusqueda | null>;
  /** Búsqueda difusa por nombre completo vía el índice trigram ya existente (RF-08). */
  buscarPorNombre(
    nombre: string,
    limite: number,
  ): Promise<UsuariaResumenBusqueda[]>;
  obtenerHub(id: string): Promise<UsuariaExpedienteHub | null>;
  existeDpi(dpi: string, excluirId?: string): Promise<boolean>;
  /** `null` si el id no corresponde a una `Usuaria` existente. */
  actualizarIdentidad(
    id: string,
    datos: DatosIdentidadUsuariaParams,
  ): Promise<UsuariaExpedienteHub | null>;
}
