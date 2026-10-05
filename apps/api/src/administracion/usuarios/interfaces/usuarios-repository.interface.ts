import type { Rol } from '@prisma/client';
import type { UsuarioAdminDto } from '@akyuam/shared';

export const USUARIOS_REPOSITORY = Symbol('USUARIOS_REPOSITORY');

export interface ListarUsuariosParams {
  rol?: Rol;
}

export interface CrearUsuarioParams {
  nombreCompleto: string;
  telefono: string;
  dpi: string;
  username: string;
  rol: Rol;
  puesto?: string;
  passwordHash: string;
  /**
   * Ficha de personal de la cuenta, en la misma transacción: `nueva` la crea con el nombre
   * y el puesto; `existente` enlaza una ficha que ya existía. `null` para áreas sin catálogo.
   */
  fichaPersonal: { modo: 'nueva' } | { modo: 'existente'; id: string } | null;
}

export interface EditarUsuarioParams {
  id: string;
  nombreCompleto: string;
  telefono: string;
  dpi: string;
  username: string;
}

export interface FichaPersonalRow {
  id: string;
  area: Rol;
  tipo: string;
  usuarioId: string | null;
}

export interface IUsuariosRepository {
  listar(params: ListarUsuariosParams): Promise<UsuarioAdminDto[]>;
  buscarPorId(id: string): Promise<UsuarioAdminDto | null>;
  crear(params: CrearUsuarioParams): Promise<UsuarioAdminDto>;
  /** `null` si el id no corresponde a un `Usuario` existente. */
  editar(params: EditarUsuarioParams): Promise<UsuarioAdminDto | null>;
  actualizarPassword(id: string, passwordHash: string): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<UsuarioAdminDto | null>;
  existeUsername(username: string, excluirId?: string): Promise<boolean>;
  existeDpi(dpi: string, excluirId?: string): Promise<boolean>;
  buscarFichaPersonal(id: string): Promise<FichaPersonalRow | null>;
  /**
   * Deja la cuenta enlazada solo a `personalId` (o a ninguna ficha si es `null`). La ficha
   * anterior queda sin cuenta, nunca se borra: conserva su historial de procesos.
   */
  vincularFichaPersonal(
    usuarioId: string,
    personalId: string | null,
  ): Promise<UsuarioAdminDto>;
}
