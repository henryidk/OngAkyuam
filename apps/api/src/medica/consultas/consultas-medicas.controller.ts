import {
  Body,
  Controller,
  Get,
  Headers,
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
  contextoConsultaMedicaQuerySchema,
  registrarConsultaMedicaSchema,
  subirDocumentoMedicoSchema,
} from '@akyuam/shared';
import type {
  ContextoConsultaMedicaQuery,
  RegistrarConsultaMedicaDatos,
  SubirDocumentoMedicoInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { DocumentosMedicosService } from '../documentos/documentos-medicos.service';
import { ConsultasMedicasService } from './consultas-medicas.service';
import { RegistroConsultaService } from './registro-consulta.service';

@Controller('medica/consultas')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class ConsultasMedicasController {
  constructor(
    private readonly consultasService: ConsultasMedicasService,
    private readonly registroService: RegistroConsultaService,
    private readonly documentosService: DocumentosMedicosService,
  ) {}

  /** Ficha de solo lectura y personas para abrir el formulario de consulta. */
  @Get('contexto')
  contexto(
    @Query(new ZodValidationPipe(contextoConsultaMedicaQuerySchema))
    query: ContextoConsultaMedicaQuery,
  ) {
    return this.consultasService.contexto(query);
  }

  @Post()
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  registrar(
    @Body(new ZodValidationPipe(registrarConsultaMedicaSchema))
    datos: RegistrarConsultaMedicaDatos,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('idempotency-key') claveIdempotencia?: string,
  ) {
    return this.registroService.registrar(datos, contexto, claveIdempotencia);
  }

  /** Un archivo por petición, a una consulta ya guardada. */
  @Post(':id/documentos')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirDocumento(
    @Param('id', ParseUUIDPipe) consultaId: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(subirDocumentoMedicoSchema))
    datos: SubirDocumentoMedicoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.documentosService.subirAConsulta(
      consultaId,
      archivo,
      datos,
      contexto,
    );
  }
}
