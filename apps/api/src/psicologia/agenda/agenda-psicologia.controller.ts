import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  agendarCitaPsicologicaSchema,
  huecosAgendaQuerySchema,
  moverCitaPsicologicaSchema,
  rangoFechasQuerySchema,
} from '@akyuam/shared';
import type {
  AgendarCitaPsicologicaInput,
  HuecosAgendaQuery,
  MoverCitaPsicologicaInput,
  RangoFechasQuery,
} from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { AgendaPsicologiaService } from './agenda-psicologia.service';

@Controller('psicologia')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class AgendaPsicologiaController {
  constructor(private readonly agendaService: AgendaPsicologiaService) {}

  @Get('agenda/citas')
  listarCitas(
    @Query(new ZodValidationPipe(rangoFechasQuerySchema))
    query: RangoFechasQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.agendaService.listarCitas(query, usuario.id);
  }

  @Get('agenda/huecos')
  huecos(
    @Query(new ZodValidationPipe(huecosAgendaQuerySchema))
    query: HuecosAgendaQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.agendaService.huecos(query, usuario.id);
  }

  @Get('agenda/procesos')
  listarProcesosParaAgendar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.agendaService.listarProcesosParaAgendar(usuario.id);
  }

  @Post('procesos/:procesoId/citas')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  programarCita(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(agendarCitaPsicologicaSchema))
    datos: AgendarCitaPsicologicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.agendaService.programarCita(procesoId, datos, contexto);
  }

  @Post('citas/:citaId/reprogramacion')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  moverCita(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(moverCitaPsicologicaSchema))
    datos: MoverCitaPsicologicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.agendaService.moverCita(citaId, datos, contexto);
  }

  @Post('citas/:citaId/no-asistio')
  @HttpCode(200)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  marcarNoAsistio(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.agendaService.marcarNoAsistio(citaId, contexto);
  }
}
