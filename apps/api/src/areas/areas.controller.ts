import { Controller, Get, Ip, Param, Req, UseGuards } from '@nestjs/common';
import { AREAS_ATENCION } from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AreasService } from './areas.service';

@Controller('areas/expedientes')
@UseGuards(RolesGuard)
// AREAS_ATENCION es la misma fuente de verdad usada por el checkbox del wizard —
// evita que este listado de roles se desincronice de "qué es un área de atención".
@Roles(...AREAS_ATENCION)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.areasService.listarReferidos(usuario.rol);
  }

  @Get(':id')
  detalle(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.areasService.obtenerDetalle(id, usuario, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':id/documentos/:documentoId/url')
  obtenerUrlDescarga(
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.areasService.obtenerUrlDescarga(id, documentoId, usuario, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
