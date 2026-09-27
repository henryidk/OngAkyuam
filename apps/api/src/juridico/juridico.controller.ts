import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
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
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.crearProceso(expedienteId, datos, contexto);
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
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.obtenerDetalle(procesoId, contexto);
  }

  // El PATCH único del plan ("editar asignación, o cerrar el proceso") se separa en dos
  // endpoints de un solo propósito cada uno (SRP, ver planjuridico.md punto 11) en vez de
  // una sola ruta que interpreta el body para decidir qué hacer.
  @Patch('procesos/:procesoId/asignacion')
  editarAsignacion(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(editarAsignacionProcesoSchema))
    datos: EditarAsignacionProcesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.editarAsignacion(procesoId, datos, contexto);
  }

  @Patch('procesos/:procesoId/cierre')
  cerrarProceso(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(cerrarProcesoSchema)) datos: CerrarProcesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.cerrarProceso(procesoId, datos, contexto);
  }

  @Post('procesos/:procesoId/notas')
  agregarNota(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(agregarNotaAvanceSchema))
    datos: AgregarNotaAvanceInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.agregarNota(procesoId, datos, contexto);
  }

  @Post('procesos/:procesoId/abandono')
  registrarAbandono(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(registrarAbandonoSchema))
    datos: RegistrarAbandonoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.registrarAbandono(procesoId, datos, contexto);
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
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.subirDocumento(
      procesoId,
      { nombreVisible, archivo },
      contexto,
    );
  }

  @Get('procesos/:procesoId/documentos/:documentoId/url')
  obtenerUrlDescarga(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.juridicoService.obtenerUrlDescarga(
      procesoId,
      documentoId,
      contexto,
    );
  }
}
