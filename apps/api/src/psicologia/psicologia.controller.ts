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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  actualizarCitaSchema,
  actualizarEstadoAtencionSchema,
  programarCitaSchema,
  rangoFechasQuerySchema,
  type ActualizarCitaInput,
  type ActualizarEstadoAtencionInput,
  type ProgramarCitaInput,
  type RangoFechasQuery,
} from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PsicologiaService } from './psicologia.service';

@Controller('psicologia')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class PsicologiaController {
  constructor(private readonly psicologiaService: PsicologiaService) {}

  @Get('expedientes/:expedienteId/atencion')
  obtenerAtencion(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.psicologiaService.obtenerAtencion(expedienteId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('expedientes/:expedienteId/atencion')
  actualizarEstadoAtencion(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(actualizarEstadoAtencionSchema))
    datos: ActualizarEstadoAtencionInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.psicologiaService.actualizarEstadoAtencion(
      expedienteId,
      datos,
      {
        usuarioId: usuario.id,
        username: usuario.username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post('expedientes/:expedienteId/citas')
  programarCita(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(programarCitaSchema))
    datos: ProgramarCitaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.psicologiaService.programarCita(expedienteId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('citas/:citaId')
  actualizarCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(actualizarCitaSchema))
    datos: ActualizarCitaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.psicologiaService.actualizarCita(citaId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('citas/:citaId/documento')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirDocumentoCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.psicologiaService.subirDocumentoCita(citaId, archivo, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('citas/:citaId/documento/url')
  obtenerUrlDescargaDocumentoCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.psicologiaService.obtenerUrlDescargaDocumentoCita(citaId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // Rutas sin :id, no colisionan con las de arriba (un segmento menos).
  @Get('agenda')
  listarAgenda(
    @Query(new ZodValidationPipe(rangoFechasQuerySchema))
    query: RangoFechasQuery,
  ) {
    return this.psicologiaService.listarAgenda(query);
  }

  @Get('reporte')
  obtenerReporte(
    @Query(new ZodValidationPipe(rangoFechasQuerySchema))
    query: RangoFechasQuery,
  ) {
    return this.psicologiaService.obtenerReporte(query);
  }
}
