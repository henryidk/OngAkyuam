import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  urlDocumentoQuerySchema,
  type UrlDocumentoQuery,
} from '@akyuam/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DocumentosService } from './documentos.service';

const INTERCEPTOR_ARCHIVO = FileInterceptor('archivo', {
  limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
});

@Controller('trabajo-social/expedientes/:expedienteId/documentos')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get()
  async listar(@Param('expedienteId', ParseUUIDPipe) expedienteId: string) {
    return this.documentosService.listar(expedienteId);
  }

  @Post()
  @UseInterceptors(INTERCEPTOR_ARCHIVO)
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

  @Get(':documentoId/versiones')
  async listarVersiones(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
  ) {
    return this.documentosService.listarVersiones(expedienteId, documentoId);
  }

  @Post(':documentoId/versiones')
  @UseInterceptors(INTERCEPTOR_ARCHIVO)
  async subirVersion(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @UploadedFile() archivo: Express.Multer.File,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.subirVersion(
      { expedienteId, documentoId, archivo },
      contexto,
    );
  }

  @Get(':documentoId/url')
  async obtenerUrl(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @Query(new ZodValidationPipe(urlDocumentoQuerySchema))
    query: UrlDocumentoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.obtenerUrl(
      expedienteId,
      documentoId,
      query.inline,
      contexto,
    );
  }
}
