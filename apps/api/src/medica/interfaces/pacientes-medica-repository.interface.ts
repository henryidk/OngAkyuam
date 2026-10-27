import type {
  FichaPacienteMedicaDto,
  PacienteBuscadaMedicaDto,
  FiltroPacientesMedica,
  PacientesMedicaPaginaDto,
} from '@akyuam/shared';
import type { BusquedaListaUsuarias } from '../../common/busqueda-usuarias';

export interface ListarPacientesMedicaParams {
  busqueda: BusquedaListaUsuarias | undefined;
  estado: FiltroPacientesMedica | undefined;
  /** Cursor opaco de la página anterior (orden por nombre). */
  cursor: string | undefined;
  porPagina: number;
  ahora: Date;
}

export type SituacionProgramable = PacienteBuscadaMedicaDto['situacion'];

export interface BuscarProgramablesParams {
  busqueda: BusquedaListaUsuarias | undefined;
  situaciones: readonly SituacionProgramable[];
  /** `relevancia`: parecido del nombre y luego orden alfabético. `referencia`: la referencia pendiente más antigua primero. */
  orden: 'relevancia' | 'referencia';
  limite: number;
  ahora: Date;
}

export interface IPacientesMedicaRepository {
  /** Usuarias con algún expediente referido a Medicina, con la situación sumando todos ellos. */
  listar(
    params: ListarPacientesMedicaParams,
  ): Promise<PacientesMedicaPaginaDto>;
  /** Buscador de los modales: pocas filas, sin conteos ni cursor. */
  buscarProgramables(
    params: BuscarProgramablesParams,
  ): Promise<PacienteBuscadaMedicaDto[]>;
  /** null si la usuaria no tiene ningún expediente referido a Medicina. */
  ficha(usuariaId: string, ahora: Date): Promise<FichaPacienteMedicaDto | null>;
}

export const PACIENTES_MEDICA_REPOSITORY = Symbol(
  'PACIENTES_MEDICA_REPOSITORY',
);
