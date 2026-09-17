import { Injectable } from '@nestjs/common';
import type { UsuarioAdminDto } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CrearUsuarioParams,
  EditarUsuarioParams,
  IUsuariosRepository,
  ListarUsuariosParams,
} from '../interfaces/usuarios-repository.interface';

// Select explícito, hermano de `USUARIO_PUBLICO_SELECT` en auth — nunca `passwordHash`.
// Es un select propio (no se reutiliza el de auth) porque ese es para el propio usuario
// logueado, no para que Administración vea las cuentas de otros.
const USUARIO_ADMIN_SELECT = {
  id: true,
  nombreCompleto: true,
  username: true,
  telefono: true,
  dpi: true,
  rol: true,
  puesto: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

type UsuarioAdminRow = {
  id: string;
  nombreCompleto: string;
  username: string;
  telefono: string | null;
  dpi: string | null;
  rol: UsuarioAdminDto['rol'];
  puesto: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

function mapear(usuario: UsuarioAdminRow): UsuarioAdminDto {
  return {
    id: usuario.id,
    nombreCompleto: usuario.nombreCompleto,
    username: usuario.username,
    telefono: usuario.telefono,
    dpi: usuario.dpi,
    rol: usuario.rol,
    puesto: usuario.puesto,
    isActive: usuario.isActive,
    mustChangePassword: usuario.mustChangePassword,
    createdAt: usuario.createdAt,
  };
}

@Injectable()
export class UsuariosRepository implements IUsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(params: ListarUsuariosParams): Promise<UsuarioAdminDto[]> {
    const usuarios = await this.prisma.usuario.findMany({
      where: params.rol ? { rol: params.rol } : {},
      select: USUARIO_ADMIN_SELECT,
      orderBy: { nombreCompleto: 'asc' },
    });
    return usuarios.map(mapear);
  }

  async buscarPorId(id: string): Promise<UsuarioAdminDto | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: USUARIO_ADMIN_SELECT,
    });
    return usuario ? mapear(usuario) : null;
  }

  async crear(params: CrearUsuarioParams): Promise<UsuarioAdminDto> {
    const usuario = await this.prisma.usuario.create({
      data: {
        nombreCompleto: params.nombreCompleto,
        telefono: params.telefono,
        dpi: params.dpi,
        username: params.username,
        rol: params.rol,
        puesto: params.puesto,
        passwordHash: params.passwordHash,
        mustChangePassword: true,
      },
      select: USUARIO_ADMIN_SELECT,
    });
    return mapear(usuario);
  }

  async editar(params: EditarUsuarioParams): Promise<UsuarioAdminDto | null> {
    try {
      const usuario = await this.prisma.usuario.update({
        where: { id: params.id },
        data: {
          nombreCompleto: params.nombreCompleto,
          telefono: params.telefono,
          dpi: params.dpi,
          username: params.username,
        },
        select: USUARIO_ADMIN_SELECT,
      });
      return mapear(usuario);
    } catch {
      // P2025: registro no encontrado — mismo criterio uniforme del resto del proyecto.
      return null;
    }
  }

  async actualizarPassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
  }

  async setActive(
    id: string,
    isActive: boolean,
  ): Promise<UsuarioAdminDto | null> {
    try {
      const usuario = await this.prisma.usuario.update({
        where: { id },
        data: { isActive },
        select: USUARIO_ADMIN_SELECT,
      });
      return mapear(usuario);
    } catch {
      return null;
    }
  }

  async existeUsername(username: string, excluirId?: string): Promise<boolean> {
    const existente = await this.prisma.usuario.findUnique({
      where: { username },
      select: { id: true },
    });
    return !!existente && existente.id !== excluirId;
  }

  async existeDpi(dpi: string, excluirId?: string): Promise<boolean> {
    const existente = await this.prisma.usuario.findUnique({
      where: { dpi },
      select: { id: true },
    });
    return !!existente && existente.id !== excluirId;
  }
}
