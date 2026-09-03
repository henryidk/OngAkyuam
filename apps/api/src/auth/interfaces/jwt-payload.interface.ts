import type { Rol } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  username: string;
  rol: Rol;
}

export interface JwtRefreshPayload {
  sub: string;
  username: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  nombreCompleto: string;
  rol: Rol;
  mustChangePassword: boolean;
}
