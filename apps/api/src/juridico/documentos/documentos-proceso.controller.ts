import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { Throttle } from '@nestjs/throttler';
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  nombreCarpetaSchema,
  renombrarDocumentoProcesoSchema,
  urlDocumentoProcesoQuerySchema,
  type NombreCarpetaInput,
  type RenombrarDocumentoProcesoInput,
  type UrlDocumentoProcesoQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../compartido/limite-por-usuario.guard';
import { DocumentosProcesoService } from './documentos-proceso.service';

@Controller('juridico/procesos/:procesoId')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class DocumentosProcesoController {
  constructor(private readonly documentosService: DocumentosProcesoService) {}

  @Post('carpetas')
  crearCarpeta(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(nombreCarpetaSchema)) datos: NombreCarpetaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.crearCarpeta(
      procesoId,
      datos.nombre,
      contexto,
    );
  }

  @Patch('carpetas/:carpetaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  renombrarCarpeta(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('carpetaId', ParseUUIDPipe) carpetaId: string,
    @Body(new ZodValidationPipe(nombreCarpetaSchema)) datos: NombreCarpetaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.renombrarCarpeta(
      procesoId,
      carpetaId,
      datos.nombre,
      contexto,
    );
  }

  @Post('carpetas/:carpetaId/documentos')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subir(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('carpetaId', ParseUUIDPipe) carpetaId: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body('nombreVisible') nombreVisible: unknown,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('x-lote-subida') tanda?: string,
  ) {
    return this.documentosService.subir(
      {
        procesoId,
        carpetaId,
        archivo,
        nombreVisible:
          typeof nombreVisible === 'string' ? nombreVisible : undefined,
        tanda,
      },
      contexto,
    );
  }

  @Patch('documentos/:documentoId')
  renombrarDocumento(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @Body(new ZodValidationPipe(renombrarDocumentoProcesoSchema))
    datos: RenombrarDocumentoProcesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.renombrarDocumento(
      procesoId,
      documentoId,
      datos.nombreVisible,
      contexto,
    );
  }

  @Get('documentos/:documentoId/url')
  generarUrl(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @Query(new ZodValidationPipe(urlDocumentoProcesoQuerySchema))
    query: UrlDocumentoProcesoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.generarUrl(
      procesoId,
      documentoId,
      query.modo,
      contexto,
    );
  }
}
