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
import {
  listarProfesionalesQuerySchema,
  referirSchema,
  type ListarProfesionalesQuery,
  type ReferirInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReferidosService } from './referidos.service';

@Controller('trabajo-social')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class ReferidosController {
  constructor(private readonly referidosService: ReferidosService) {}

  @Post('expedientes/:expedienteId/referidos')
  async referir(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(referirSchema)) datos: ReferirInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.referidosService.referir(expedienteId, datos, contexto);
  }

  @Get('profesionales')
  async listarProfesionales(
    @Query(new ZodValidationPipe(listarProfesionalesQuerySchema))
    query: ListarProfesionalesQuery,
  ) {
    return this.referidosService.listarProfesionales(query.area);
  }
}
