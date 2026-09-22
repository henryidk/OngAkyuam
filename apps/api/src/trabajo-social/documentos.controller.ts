import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DOCUMENTO_TAMANIO_MAXIMO_BYTES } from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DocumentosService } from './documentos.service';

@Controller('trabajo-social/expedientes/:expedienteId/documentos')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  async subir(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body('tipo') tipo: string | undefined,
    @Body('areasVisibles') areasVisibles: string | undefined,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.documentosService.subir(
      { expedienteId, tipo, areasVisiblesRaw: areasVisibles, archivo },
      {
        usuarioId: usuario.id,
        username: usuario.username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Get(':documentoId/url')
  async obtenerUrlDescarga(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.documentosService.obtenerUrlDescarga(
      expedienteId,
      documentoId,
      {
        usuarioId: usuario.id,
        username: usuario.username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
