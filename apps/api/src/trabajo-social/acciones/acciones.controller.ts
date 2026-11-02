import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  registrarAccionTrabajoSocialSchema,
  type RegistrarAccionTrabajoSocialInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccionesService } from './acciones.service';

@Controller('trabajo-social')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class AccionesController {
  constructor(private readonly accionesService: AccionesService) {}

  @Get('expedientes/:expedienteId/acciones')
  async listar(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.accionesService.listar(expedienteId, contexto);
  }

  @Post('expedientes/:expedienteId/acciones')
  async registrar(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(registrarAccionTrabajoSocialSchema))
    datos: RegistrarAccionTrabajoSocialInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.accionesService.registrar(expedienteId, datos, contexto);
  }
}
