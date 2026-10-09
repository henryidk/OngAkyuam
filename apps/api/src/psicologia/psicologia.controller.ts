import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  indicadoresQuerySchema,
  registroConsultaSchema,
  type IndicadoresQuery,
  type RegistroConsultaInput,
} from '@akyuam/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LimitePorUsuarioGuard } from '../juridico/compartido/limite-por-usuario.guard';
import { CitasPsicologicasService } from './services/citas-psicologicas.service';
import { IndicadoresPsicologiaService } from './services/indicadores-psicologia.service';
import { RegistroConsultaService } from './services/registro-consulta.service';

/** Lo que cuelga de una cita ya existente (su registro y su documento) y los indicadores. */
@Controller('psicologia')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class PsicologiaController {
  constructor(
    private readonly citasService: CitasPsicologicasService,
    private readonly registroService: RegistroConsultaService,
    private readonly indicadoresService: IndicadoresPsicologiaService,
  ) {}

  @Put('citas/:citaId/registro')
  registrarConsulta(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(registroConsultaSchema))
    datos: RegistroConsultaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.registroService.registrarConsulta(citaId, datos, contexto);
  }

  @Get('citas/:citaId')
  obtenerDetalleCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.citasService.obtenerDetalleCita(citaId, usuario.id);
  }

  @Post('citas/:citaId/documento')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: DOCUMENTO_TAMANIO_MAXIMO_BYTES },
    }),
  )
  subirDocumentoCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @UploadedFile() archivo: Express.Multer.File,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.registroService.subirDocumentoCita(citaId, archivo, contexto);
  }

  @Get('citas/:citaId/documento/url')
  obtenerUrlDescargaDocumentoCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.registroService.obtenerUrlDescargaDocumentoCita(
      citaId,
      contexto,
    );
  }

  @Get('indicadores')
  obtenerIndicadores(
    @Query(new ZodValidationPipe(indicadoresQuerySchema))
    query: IndicadoresQuery,
    @CurrentUser() usuario: AuthenticatedUser,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.indicadoresService.obtenerIndicadores(
      query,
      usuario.id,
      contexto,
    );
  }

  /** Excel de personas atendidas en el año. Pocas descargas por minuto: genera un archivo completo. */
  @Get('indicadores.xlsx')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportarIndicadores(
    @Query(new ZodValidationPipe(indicadoresQuerySchema))
    query: IndicadoresQuery,
    @CurrentUser() usuario: AuthenticatedUser,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ): Promise<StreamableFile> {
    const archivo = await this.indicadoresService.exportar(
      query,
      usuario.id,
      contexto,
    );
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipoContenido,
      disposition: `attachment; filename="${archivo.nombreArchivo}"`,
      length: archivo.contenido.length,
    });
  }
}
