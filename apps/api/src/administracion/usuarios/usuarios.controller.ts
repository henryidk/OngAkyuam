import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  listarUsuariosQuerySchema,
  vincularFichaPersonalSchema,
  type CrearUsuarioInput,
  type EditarUsuarioInput,
  type ListarUsuariosQuery,
  type VincularFichaPersonalInput,
} from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
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
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariosService.crear(datos, contexto);
  }

  // Sin DELETE: se desactiva, nunca se borra (mismo criterio que `personal`).
  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarUsuarioSchema)) datos: EditarUsuarioInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariosService.editar(id, datos, contexto);
  }

  @Patch(':id/ficha-personal')
  vincularFichaPersonal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(vincularFichaPersonalSchema))
    datos: VincularFichaPersonalInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariosService.vincularFichaPersonal(id, datos, contexto);
  }

  @Patch(':id/resetear-password')
  resetearPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariosService.resetearPassword(id, usuario, contexto);
  }

  @Patch(':id/desactivar')
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariosService.desactivar(id, usuario, contexto);
  }

  @Patch(':id/activar')
  activar(
    @Param('id', ParseUUIDPipe) id: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariosService.activar(id, contexto);
  }
}
