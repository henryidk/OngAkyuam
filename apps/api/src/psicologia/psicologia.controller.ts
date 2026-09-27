import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  actualizarCitaSchema,
  actualizarEstadoAtencionSchema,
  agendaResumenQuerySchema,
  buscarExpedientesQuerySchema,
  historialCitasQuerySchema,
  indicadoresQuerySchema,
  programarCitaSchema,
  rangoFechasQuerySchema,
  registroConsultaSchema,
  reprogramarCitaSchema,
  type ActualizarCitaInput,
  type ActualizarEstadoAtencionInput,
  type AgendaResumenQuery,
  type BuscarExpedientesQuery,
  type HistorialCitasQuery,
  type IndicadoresQuery,
  type ProgramarCitaInput,
  type RangoFechasQuery,
  type RegistroConsultaInput,
  type ReprogramarCitaInput,
} from '@akyuam/shared';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CitasPsicologicasService } from './services/citas-psicologicas.service';
import { IndicadoresPsicologiaService } from './services/indicadores-psicologia.service';
import { ProcesoPsicologicoService } from './services/proceso-psicologico.service';
import { RegistroConsultaService } from './services/registro-consulta.service';
import { TableroPsicologiaService } from './services/tablero-psicologia.service';

@Controller('psicologia')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class PsicologiaController {
  constructor(
    private readonly procesoService: ProcesoPsicologicoService,
    private readonly citasService: CitasPsicologicasService,
    private readonly registroService: RegistroConsultaService,
    private readonly indicadoresService: IndicadoresPsicologiaService,
    private readonly tableroService: TableroPsicologiaService,
  ) {}

  @Get('tablero')
  obtenerTablero(@CurrentUser() usuario: AuthenticatedUser) {
    return this.tableroService.obtenerTablero(usuario.id);
  }

  @Get('expedientes')
  buscarExpedientes(
    @Query(new ZodValidationPipe(buscarExpedientesQuerySchema))
    query: BuscarExpedientesQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.procesoService.buscarExpedientes(query, usuario.id);
  }

  @Get('expedientes/:expedienteId/resumen')
  obtenerResumenExpediente(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.procesoService.obtenerResumenExpediente(
      expedienteId,
      usuario.id,
    );
  }

  @Get('expedientes/:expedienteId/citas')
  listarHistorialCitas(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Query(new ZodValidationPipe(historialCitasQuerySchema))
    query: HistorialCitasQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.citasService.listarHistorialCitas(
      expedienteId,
      query,
      usuario.id,
    );
  }

  @Get('expedientes/:expedienteId/atencion')
  obtenerAtencion(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.procesoService.obtenerAtencion(expedienteId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('expedientes/:expedienteId/atencion')
  actualizarEstadoAtencion(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(actualizarEstadoAtencionSchema))
    datos: ActualizarEstadoAtencionInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.procesoService.actualizarEstadoAtencion(expedienteId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('expedientes/:expedienteId/tomar')
  tomarCaso(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.procesoService.tomarCaso(expedienteId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('referencias-sin-tomar')
  listarReferenciasSinTomar() {
    return this.procesoService.listarReferenciasSinTomar();
  }

  @Post('expedientes/:expedienteId/citas')
  programarCita(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(programarCitaSchema))
    datos: ProgramarCitaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.citasService.programarCita(expedienteId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('citas/:citaId/reprogramar')
  reprogramarCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(reprogramarCitaSchema))
    datos: ReprogramarCitaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.citasService.reprogramarCita(citaId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Put('citas/:citaId/registro')
  registrarConsulta(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(registroConsultaSchema))
    datos: RegistroConsultaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.registroService.registrarConsulta(citaId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('citas/:citaId')
  obtenerDetalleCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.citasService.obtenerDetalleCita(citaId, usuario.id);
  }

  @Patch('citas/:citaId')
  actualizarCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(actualizarCitaSchema))
    datos: ActualizarCitaInput,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.registroService.actualizarCita(citaId, datos, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
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
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.registroService.subirDocumentoCita(citaId, archivo, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('citas/:citaId/documento/url')
  obtenerUrlDescargaDocumentoCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.registroService.obtenerUrlDescargaDocumentoCita(citaId, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // Rutas sin :id, no colisionan con las de arriba (un segmento menos).
  @Get('agenda')
  listarAgenda(
    @Query(new ZodValidationPipe(rangoFechasQuerySchema))
    query: RangoFechasQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.citasService.listarAgenda(query, usuario.id);
  }

  @Get('agenda/resumen')
  obtenerResumenAgenda(
    @Query(new ZodValidationPipe(agendaResumenQuerySchema))
    query: AgendaResumenQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.citasService.obtenerResumenAgenda(query, usuario.id);
  }

  @Get('reporte')
  obtenerReporte(
    @Query(new ZodValidationPipe(rangoFechasQuerySchema))
    query: RangoFechasQuery,
  ) {
    return this.indicadoresService.obtenerReporte(query);
  }

  @Get('indicadores')
  obtenerIndicadores(
    @Query(new ZodValidationPipe(indicadoresQuerySchema))
    query: IndicadoresQuery,
    @CurrentUser() usuario: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.indicadoresService.obtenerIndicadores(query, usuario.id, {
      usuarioId: usuario.id,
      username: usuario.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
