import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  crearExpedienteSchema,
  type CrearExpedienteInput,
} from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExpedientesService } from './expedientes.service';

@Controller('trabajo-social/expedientes')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Post()
  async crear(
    @Body(new ZodValidationPipe(crearExpedienteSchema))
    datos: CrearExpedienteInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.expedientesService.crear(datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':id')
  async obtenerDetalle(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.expedientesService.obtenerDetalle(id, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
