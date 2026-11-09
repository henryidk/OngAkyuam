import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  abrirProcesosPsicologiaSchema,
  atenderAhoraSchema,
  reservarCasoSchema,
} from '@akyuam/shared';
import type {
  AbrirProcesosPsicologiaInput,
  AtenderAhoraInput,
  ReservarCasoInput,
} from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { AperturaProcesoService } from '../procesos/apertura-proceso.service';
import { BandejaPsicologiaService } from './bandeja-psicologia.service';

@Controller('psicologia')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class BandejaPsicologiaController {
  constructor(
    private readonly bandejaService: BandejaPsicologiaService,
    private readonly aperturaService: AperturaProcesoService,
  ) {}

  @Get('bandeja')
  listarSinTomar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.bandejaService.listarSinTomar(usuario.id);
  }

  @Get('bandeja/por-reasignar')
  listarPorReasignar() {
    return this.bandejaService.listarPorReasignar();
  }

  @Post('bandeja/por-reasignar/:procesoId/tomar')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  tomarPorReasignar(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bandejaService.tomarPorReasignar(procesoId, contexto);
  }

  /** Vista previa del expediente antes de tomar el caso: sin agresor, dirección ni teléfono. */
  @Get('bandeja/:referidoId/previa')
  obtenerPreviaToma(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bandejaService.obtenerPreviaToma(referidoId, contexto);
  }

  /** A quién se le puede agendar la primera cita: la referencia tiene que seguir sin tomar. */
  @Get('bandeja/:referidoId/para-agendar')
  obtenerParaAgendar(@Param('referidoId', ParseUUIDPipe) referidoId: string) {
    return this.bandejaService.obtenerParaAgendar(referidoId);
  }

  /**
   * Reserva o renueva la referencia mientras se agenda o se atiende; la pantalla abierta la
   * llama cada pocos segundos. Ni reservar ni liberar se auditan: no tocan el caso.
   */
  @Post('bandeja/:referidoId/reserva')
  @HttpCode(204)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reservar(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @Body(new ZodValidationPipe(reservarCasoSchema)) datos: ReservarCasoInput,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.bandejaService.reservar(referidoId, datos.motivo, usuario);
  }

  @Delete('bandeja/:referidoId/reserva')
  @HttpCode(204)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  liberar(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.bandejaService.liberar(referidoId, usuario.id);
  }

  @Post('bandeja/:referidoId/atender')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  atender(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @Body(new ZodValidationPipe(abrirProcesosPsicologiaSchema))
    datos: AbrirProcesosPsicologiaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('idempotency-key') claveIdempotencia?: string,
  ) {
    return this.aperturaService.atender(
      referidoId,
      datos,
      contexto,
      claveIdempotencia,
    );
  }

  /** La persona llegó sin primera cita: se abre su proceso y se registra la sesión, todo junto. */
  @Post('bandeja/:referidoId/atender-ahora')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  atenderAhora(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @Body(new ZodValidationPipe(atenderAhoraSchema))
    datos: AtenderAhoraInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('idempotency-key') claveIdempotencia?: string,
  ) {
    return this.aperturaService.atenderAhora(
      referidoId,
      datos,
      contexto,
      claveIdempotencia,
    );
  }
}
