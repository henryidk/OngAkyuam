import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  registrarActuacionSchema,
  type RegistrarActuacionInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../compartido/limite-por-usuario.guard';
import { BitacoraService } from './bitacora.service';

@Controller('juridico/procesos/:procesoId')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Post('bitacora')
  registrarActuacion(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(registrarActuacionSchema))
    datos: RegistrarActuacionInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bitacoraService.registrarActuacion(procesoId, datos, contexto);
  }

  @Post('bitacora/:entradaId/documentos')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirDocumento(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Param('entradaId', ParseUUIDPipe) entradaId: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body('nombreVisible') nombreVisible: unknown,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('x-lote-subida') tanda?: string,
  ) {
    return this.bitacoraService.subirDocumento(
      procesoId,
      entradaId,
      {
        archivo,
        nombreVisible:
          typeof nombreVisible === 'string' ? nombreVisible : undefined,
        tanda,
      },
      contexto,
    );
  }
}
