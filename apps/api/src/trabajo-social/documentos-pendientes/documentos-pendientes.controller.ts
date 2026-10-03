import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DOCUMENTO_TAMANIO_MAXIMO_BYTES } from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { DocumentosPendientesService } from './documentos-pendientes.service';

/** Escaneos del paso "Documentos" del registro, antes de que exista el expediente. */
@Controller('trabajo-social/documentos-pendientes')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class DocumentosPendientesController {
  constructor(private readonly service: DocumentosPendientesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  async subir(
    @Body('tipo') tipo: string | undefined,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.service.subir({ tipo, archivo }, contexto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async descartar(
    @Param('id', ParseUUIDPipe) id: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    await this.service.descartar(id, contexto);
  }
}
