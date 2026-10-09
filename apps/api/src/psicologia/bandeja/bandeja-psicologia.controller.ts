import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { agendarCitaPsicologicaSchema } from '@akyuam/shared';
import type { AgendarCitaPsicologicaInput } from '@akyuam/shared';
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
  listarSinTomar() {
    return this.bandejaService.listarSinTomar();
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

  @Get('agenda/por-agendar')
  listarPorAgendar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.bandejaService.listarPorAgendar(usuario.id);
  }

  /** Vista previa del expediente antes de tomar el caso: sin agresor, dirección ni teléfono. */
  @Get('bandeja/:referidoId/previa')
  obtenerPreviaToma(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bandejaService.obtenerPreviaToma(referidoId, contexto);
  }

  @Post('bandeja/:referidoId/tomar')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  tomar(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bandejaService.tomar(referidoId, contexto);
  }

  @Post('bandeja/:referidoId/atender')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  atender(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @Body(new ZodValidationPipe(agendarCitaPsicologicaSchema))
    datos: AgendarCitaPsicologicaInput,
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
}
