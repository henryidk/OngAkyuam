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
  crearExpedienteSchema,
  type CrearExpedienteInput,
} from '@akyuam/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExpedientesService } from './expedientes.service';

@Controller('trabajo-social/expedientes')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Post()
  async crear(
    @Body(new ZodValidationPipe(crearExpedienteSchema))
    datos: CrearExpedienteInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.expedientesService.crear(datos, contexto);
  }

  @Get(':id')
  async obtenerDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.expedientesService.obtenerDetalle(id, contexto);
  }
}
