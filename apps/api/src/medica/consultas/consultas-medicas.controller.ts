import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
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
  buscarHistorialConsultasMedicaSchema,
  contextoConsultaMedicaQuerySchema,
  registrarConsultaMedicaSchema,
  subirDocumentoMedicoSchema,
} from '@akyuam/shared';
import type {
  BuscarHistorialConsultasMedicaDatos,
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
import { HistorialConsultasService } from './historial-consultas.service';
import { PorAtenderService } from './por-atender.service';
import { RegistroConsultaService } from './registro-consulta.service';

@Controller('medica/consultas')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class ConsultasMedicasController {
  constructor(
    private readonly consultasService: ConsultasMedicasService,
    private readonly registroService: RegistroConsultaService,
    private readonly documentosService: DocumentosMedicosService,
    private readonly porAtenderService: PorAtenderService,
    private readonly historialService: HistorialConsultasService,
  ) {}

  /** Lista de trabajo: citas de hoy pendientes y las de días anteriores sin registrar. */
  @Get('por-atender')
  porAtender() {
    return this.porAtenderService.listar();
  }

  /**
   * Búsqueda en el historial. Es POST de solo lectura porque `q` puede ser el nombre de una
   * sobreviviente: en el cuerpo no queda en logs de acceso ni en el historial del navegador.
   */
  @Post('historial/busqueda')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  buscarHistorial(
    @Body(new ZodValidationPipe(buscarHistorialConsultasMedicaSchema))
    datos: BuscarHistorialConsultasMedicaDatos,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.historialService.buscar(datos, contexto);
  }

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

  /** La consulta completa, con su contenido clínico. Cada apertura queda en la auditoría. */
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detalle(
    @Param('id', ParseUUIDPipe) consultaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.historialService.detalle(consultaId, contexto);
  }
}
