import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  registrarEgresoSchema,
  type RegistrarEgresoInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EgresoService } from './egreso.service';

@Controller('trabajo-social')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class EgresoController {
  constructor(private readonly egresoService: EgresoService) {}

  @Post('expedientes/:expedienteId/egreso')
  async registrar(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(registrarEgresoSchema))
    datos: RegistrarEgresoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.egresoService.registrar(expedienteId, datos, contexto);
  }
}
