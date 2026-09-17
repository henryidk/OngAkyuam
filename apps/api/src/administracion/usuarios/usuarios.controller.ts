import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  listarUsuariosQuerySchema,
  type CrearUsuarioInput,
  type EditarUsuarioInput,
  type ListarUsuariosQuery,
} from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsuariosService } from './usuarios.service';

@Controller('administracion/usuarios')
@UseGuards(RolesGuard)
@Roles('ADMINISTRACION')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(listarUsuariosQuerySchema))
    query: ListarUsuariosQuery,
  ) {
    return this.usuariosService.listar(query);
  }

  @Post()
  crear(
    @Body(new ZodValidationPipe(crearUsuarioSchema)) datos: CrearUsuarioInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariosService.crear(datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // Sin DELETE: se desactiva, nunca se borra (mismo criterio que `personal`).
  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarUsuarioSchema)) datos: EditarUsuarioInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariosService.editar(id, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/resetear-password')
  resetearPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariosService.resetearPassword(id, usuario, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/desactivar')
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariosService.desactivar(id, usuario, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/activar')
  activar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariosService.activar(id, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
