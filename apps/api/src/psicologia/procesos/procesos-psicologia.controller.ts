import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  cerrarProcesoPsicologiaSchema,
  listarProcesosPsicologiaQuerySchema,
  sesionesProcesoPsicologiaQuerySchema,
  visibilidadProcesoPsicologiaSchema,
} from '@akyuam/shared';
import type {
  CerrarProcesoPsicologiaInput,
  ListarProcesosPsicologiaQuery,
  SesionesProcesoPsicologiaQuery,
  VisibilidadProcesoPsicologiaInput,
} from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { CierreProcesoService } from './cierre-proceso.service';
import { ConsultasProcesosService } from './consultas-procesos.service';
import { ProcesosPsicologiaService } from './procesos.service';

@Controller('psicologia/procesos')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class ProcesosPsicologiaController {
  constructor(
    private readonly cierreService: CierreProcesoService,
    private readonly procesosService: ProcesosPsicologiaService,
    private readonly consultasService: ConsultasProcesosService,
  ) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(listarProcesosPsicologiaQuerySchema))
    query: ListarProcesosPsicologiaQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.consultasService.listar(query, usuario.id);
  }

  // Antes de `:id`: si no, "resumen" se tomaría por un id de proceso.
  @Get('resumen')
  resumen(@CurrentUser() usuario: AuthenticatedUser) {
    return this.consultasService.resumen(usuario.id);
  }

  @Get(':id')
  obtener(
    @Param('id', ParseUUIDPipe) procesoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.consultasService.obtener(procesoId, contexto);
  }

  @Get(':id/sesiones')
  sesiones(
    @Param('id', ParseUUIDPipe) procesoId: string,
    @Query(new ZodValidationPipe(sesionesProcesoPsicologiaQuerySchema))
    query: SesionesProcesoPsicologiaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.consultasService.sesiones(procesoId, query, contexto);
  }

  @Post(':id/cierre')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cerrar(
    @Param('id', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(cerrarProcesoPsicologiaSchema))
    datos: CerrarProcesoPsicologiaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.cierreService.cerrar(procesoId, datos, contexto);
  }

  @Patch(':id/visibilidad')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  actualizarVisibilidad(
    @Param('id', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(visibilidadProcesoPsicologiaSchema))
    datos: VisibilidadProcesoPsicologiaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.procesosService.actualizarVisibilidad(
      procesoId,
      datos,
      contexto,
    );
  }
}
