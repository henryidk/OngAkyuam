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
}

export interface EditarUsuarioParams {
  id: string;
  nombreCompleto: string;
  telefono: string;
  dpi: string;
  username: string;
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
}
