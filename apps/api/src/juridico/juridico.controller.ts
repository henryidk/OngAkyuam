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
  agregarNotaAvanceSchema,
  cerrarProcesoSchema,
  crearProcesoJuridicoSchema,
  editarAsignacionProcesoSchema,
  listarProcesosQuerySchema,
  registrarAbandonoSchema,
  type AgregarNotaAvanceInput,
  type CerrarProcesoInput,
  type CrearProcesoJuridicoInput,
  type EditarAsignacionProcesoInput,
  type ListarProcesosQuery,
  type RegistrarAbandonoInput,
} from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JuridicoService } from './juridico.service';

@Controller('juridico')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class JuridicoController {
  constructor(private readonly juridicoService: JuridicoService) {}

  @Get('expedientes/:expedienteId/procesos')
  listarPorExpediente(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
  ) {
    return this.juridicoService.listarPorExpediente(expedienteId);
  }

  @Post('expedientes/:expedienteId/procesos')
  crearProceso(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(crearProcesoJuridicoSchema))
    datos: CrearProcesoJuridicoInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.crearProceso(expedienteId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // Vista global paginada (punto 9 del plan) — ruta sin :procesoId, no colisiona con las
  // rutas de detalle porque tiene un segmento menos.
  @Get('procesos')
  listarGlobal(
    @Query(new ZodValidationPipe(listarProcesosQuerySchema))
    query: ListarProcesosQuery,
  ) {
    return this.juridicoService.listarGlobal(query);
  }

  @Get('procesos/:procesoId')
  obtenerDetalle(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.obtenerDetalle(procesoId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // El PATCH único del plan ("editar asignación, o cerrar el proceso") se separa en dos
  // endpoints de un solo propósito cada uno (SRP, ver planjuridico.md punto 11) en vez de
  // una sola ruta que interpreta el body para decidir qué hacer.
  @Patch('procesos/:procesoId/asignacion')
  editarAsignacion(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(editarAsignacionProcesoSchema))
    datos: EditarAsignacionProcesoInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.editarAsignacion(procesoId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('procesos/:procesoId/cierre')
  cerrarProceso(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(cerrarProcesoSchema)) datos: CerrarProcesoInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.cerrarProceso(procesoId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('procesos/:procesoId/notas')
  agregarNota(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(agregarNotaAvanceSchema))
    datos: AgregarNotaAvanceInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.agregarNota(procesoId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('procesos/:procesoId/abandono')
  registrarAbandono(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(registrarAbandonoSchema))
    datos: RegistrarAbandonoInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.registrarAbandono(procesoId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('procesos/:procesoId/documentos')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirDocumento(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body('nombreVisible') nombreVisible: string | undefined,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.subirDocumento(
      procesoId,
      { nombreVisible, archivo },
      {
        usuarioId: usuario.id,
        username: usuario.username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Get('procesos/:procesoId/documentos/:documentoId/url')
  obtenerUrlDescarga(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.juridicoService.obtenerUrlDescarga(procesoId, documentoId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
