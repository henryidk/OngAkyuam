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
  agendarAudienciaSchema,
  cambiarResponsableAudienciaSchema,
  cancelarAudienciaSchema,
  disponibilidadAudienciasQuerySchema,
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  listarAudienciasQuerySchema,
  observacionesAudienciaSchema,
  registrarResultadoAudienciaSchema,
  reprogramarAudienciaSchema,
  type AgendarAudienciaInput,
  type CambiarResponsableAudienciaInput,
  type CancelarAudienciaInput,
  type DisponibilidadAudienciasQuery,
  type ListarAudienciasQuery,
  type ObservacionesAudienciaInput,
  type RegistrarResultadoAudienciaInput,
  type ReprogramarAudienciaInput,
} from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../compartido/limite-por-usuario.guard';
import { AgendaAudienciasService } from './agenda-audiencias.service';
import { ProgramacionAudienciasService } from './programacion-audiencias.service';
import { ResultadoAudienciasService } from './resultado-audiencias.service';

/** Tope de escrituras por cuenta: igual que el resto de escrituras de Jurídico. */
const LIMITE_ESCRITURAS = { default: { limit: 30, ttl: 60_000 } };

@Controller('juridico')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class AudienciasController {
  constructor(
    private readonly agendaService: AgendaAudienciasService,
    private readonly programacionService: ProgramacionAudienciasService,
    private readonly resultadoService: ResultadoAudienciasService,
  ) {}

  @Get('audiencias')
  listar(
    @Query(new ZodValidationPipe(listarAudienciasQuerySchema))
    query: ListarAudienciasQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.agendaService.listar(query, usuario.id);
  }

  @Get('audiencias/disponibilidad')
  disponibilidad(
    @Query(new ZodValidationPipe(disponibilidadAudienciasQuerySchema))
    query: DisponibilidadAudienciasQuery,
  ) {
    return this.agendaService.disponibilidad(query);
  }

  @Get('procesos/:procesoId/audiencias')
  listarPorProceso(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.agendaService.listarPorProceso(procesoId, contexto);
  }

  @Post('procesos/:procesoId/audiencias')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  agendar(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(agendarAudienciaSchema))
    datos: AgendarAudienciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.programacionService.agendar(procesoId, datos, contexto);
  }

  @Post('audiencias/:id/reprogramacion')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  reprogramar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reprogramarAudienciaSchema))
    datos: ReprogramarAudienciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.programacionService.reprogramar(id, datos, contexto);
  }

  @Post('audiencias/:id/cancelacion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cancelarAudienciaSchema))
    datos: CancelarAudienciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.programacionService.cancelar(id, datos, contexto);
  }

  @Patch('audiencias/:id/responsable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  cambiarResponsable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cambiarResponsableAudienciaSchema))
    datos: CambiarResponsableAudienciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.programacionService.cambiarResponsable(id, datos, contexto);
  }

  @Post('audiencias/:id/resultado')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  registrarResultado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(registrarResultadoAudienciaSchema))
    datos: RegistrarResultadoAudienciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.resultadoService.registrarResultado(id, datos, contexto);
  }

  @Patch('audiencias/:id/observaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  editarObservaciones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(observacionesAudienciaSchema))
    datos: ObservacionesAudienciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.resultadoService.editarObservaciones(id, datos, contexto);
  }

  @Post('audiencias/:id/documentos')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle(LIMITE_ESCRITURAS)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirDocumento(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body('nombreVisible') nombreVisible: unknown,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('x-lote-subida') tanda?: string,
  ) {
    return this.resultadoService.subirDocumento(
      id,
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
