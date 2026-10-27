import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
  subirDocumentoMedicoPendienteSchema,
  urlDocumentoMedicoQuerySchema,
} from '@akyuam/shared';
import type {
  SubirDocumentoMedicoPendienteInput,
  UrlDocumentoMedicoQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { DocumentosMedicosService } from './documentos-medicos.service';

@Controller('medica/documentos')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class DocumentosMedicosController {
  constructor(private readonly documentosService: DocumentosMedicosService) {}

  /** Documento subido mientras se llena la consulta: queda pendiente hasta guardarla. */
  @Post('pendientes')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirPendiente(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(subirDocumentoMedicoPendienteSchema))
    datos: SubirDocumentoMedicoPendienteInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.subirPendiente(archivo, datos, contexto);
  }

  @Delete('pendientes/:id')
  @HttpCode(204)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  eliminarPendiente(
    @Param('id', ParseUUIDPipe) id: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.eliminarPendiente(id, contexto);
  }

  /** URL firmada de corta duración; ver y descargar se auditan. */
  @Get(':id/url')
  url(
    @Param('id', ParseUUIDPipe) documentoId: string,
    @Query(new ZodValidationPipe(urlDocumentoMedicoQuerySchema))
    query: UrlDocumentoMedicoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.url(documentoId, query, contexto);
  }
}
