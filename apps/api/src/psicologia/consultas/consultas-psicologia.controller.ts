import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { buscarHistorialConsultasPsicologiaSchema } from '@akyuam/shared';
import type { BuscarHistorialConsultasPsicologiaDatos } from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { ConsultasPsicologiaService } from './consultas-psicologia.service';

@Controller('psicologia/consultas')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class ConsultasPsicologiaController {
  constructor(private readonly consultasService: ConsultasPsicologiaService) {}

  @Get('por-registrar')
  @Header('Cache-Control', 'no-store')
  porRegistrar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.consultasService.porRegistrar(usuario.id);
  }

  // POST de solo lectura: el nombre buscado viaja en el cuerpo, no en la URL.
  @Post('historial/busqueda')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  historial(
    @Body(new ZodValidationPipe(buscarHistorialConsultasPsicologiaSchema))
    datos: BuscarHistorialConsultasPsicologiaDatos,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.consultasService.historial(datos, contexto);
  }

  @Get(':citaId')
  @Header('Cache-Control', 'no-store')
  detalle(
    @Param('citaId', ParseUUIDPipe) citaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.consultasService.detalle(citaId, contexto);
  }
}
