import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  inasistenciaCitaMedicaSchema,
  programarCitaMedicaSchema,
  reprogramarCitaMedicaSchema,
} from '@akyuam/shared';
import type {
  InasistenciaCitaMedicaInput,
  ProgramarCitaMedicaInput,
  ReprogramarCitaMedicaInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { InasistenciaService } from './inasistencia.service';
import { ProgramacionCitaService } from './programacion-cita.service';

@Controller('medica/citas')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class CitasMedicasController {
  constructor(
    private readonly programacionService: ProgramacionCitaService,
    private readonly inasistenciaService: InasistenciaService,
  ) {}

  /** Programa una cita; si no hay atención activa, la abre con la referencia pendiente. */
  @Post()
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  programar(
    @Body(new ZodValidationPipe(programarCitaMedicaSchema))
    datos: ProgramarCitaMedicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('idempotency-key') claveIdempotencia?: string,
  ) {
    return this.programacionService.programar(
      datos,
      contexto,
      claveIdempotencia,
    );
  }

  @Post(':id/inasistencia')
  @HttpCode(200)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  inasistencia(
    @Param('id', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(inasistenciaCitaMedicaSchema))
    datos: InasistenciaCitaMedicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.inasistenciaService.registrar(citaId, datos, contexto);
  }

  @Post(':id/reprogramacion')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reprogramar(
    @Param('id', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(reprogramarCitaMedicaSchema))
    datos: ReprogramarCitaMedicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.inasistenciaService.reprogramar(citaId, datos, contexto);
  }
}
