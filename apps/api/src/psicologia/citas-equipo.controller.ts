import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  asumirCitaPsicologicaSchema,
  citasPsicologiaQuerySchema,
  type AsumirCitaPsicologicaInput,
  type CitasPsicologiaQuery,
} from '@akyuam/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LimitePorUsuarioGuard } from '../juridico/compartido/limite-por-usuario.guard';
import { CitasEquipoService } from './services/citas-equipo.service';

@Controller('psicologia/citas')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class CitasEquipoController {
  constructor(private readonly service: CitasEquipoService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(citasPsicologiaQuerySchema))
    query: CitasPsicologiaQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.service.listar(query, usuario.id);
  }

  @Post(':citaId/asumir-atencion')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  asumir(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @Body(new ZodValidationPipe(asumirCitaPsicologicaSchema))
    datos: AsumirCitaPsicologicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.service.asumir(citaId, datos, contexto);
  }
}
