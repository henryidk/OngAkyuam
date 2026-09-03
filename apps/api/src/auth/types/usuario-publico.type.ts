import type { Usuario } from '@prisma/client';

export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

// select explícito: nunca traer passwordHash del lado de la base de datos
// hacia el cliente, ni siquiera por accidente en una consulta futura.
export const USUARIO_PUBLICO_SELECT = {
  id: true,
  nombreCompleto: true,
  username: true,
  rol: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function toUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    nombreCompleto: usuario.nombreCompleto,
    username: usuario.username,
    rol: usuario.rol,
    isActive: usuario.isActive,
    mustChangePassword: usuario.mustChangePassword,
    createdAt: usuario.createdAt,
    updatedAt: usuario.updatedAt,
  };
}
