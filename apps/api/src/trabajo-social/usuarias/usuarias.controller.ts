import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  buscarUsuariaQuerySchema,
  editarIdentidadUsuariaSchema,
  nuevoCasoSchema,
  type BuscarUsuariaQuery,
  type DatosCaso,
  type EditarIdentidadUsuariaInput,
} from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ExpedientesService } from '../expedientes.service';
import { UsuariasService } from './usuarias.service';

@Controller('trabajo-social/usuarias')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class UsuariasController {
  constructor(
    private readonly usuariasService: UsuariasService,
    private readonly expedientesService: ExpedientesService,
  ) {}

  // Debe declararse antes de `:id` para que Nest no lo confunda con un id.
  @Get('buscar')
  async buscar(
    @Query(new ZodValidationPipe(buscarUsuariaQuerySchema))
    query: BuscarUsuariaQuery,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariasService.buscar(query, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':id')
  async obtenerHub(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariasService.obtenerHub(id, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  async actualizarIdentidad(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editarIdentidadUsuariaSchema))
    datos: EditarIdentidadUsuariaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.usuariasService.actualizarIdentidad(id, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/expedientes')
  @HttpCode(HttpStatus.CREATED)
  async crearCaso(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(nuevoCasoSchema))
    datosCaso: DatosCaso,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.expedientesService.crearCasoParaUsuariaExistente(
      id,
      datosCaso,
      {
        usuarioId: usuario.id,
        username: usuario.username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
