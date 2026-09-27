import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DOCUMENTO_TAMANIO_MAXIMO_BYTES } from '@akyuam/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
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
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.subir(
      { expedienteId, tipo, areasVisiblesRaw: areasVisibles, archivo },
      contexto,
    );
  }

  @Get(':documentoId/url')
  async obtenerUrlDescarga(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.obtenerUrlDescarga(
      expedienteId,
      documentoId,
      contexto,
    );
  }
}
