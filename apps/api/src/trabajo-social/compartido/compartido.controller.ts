import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { CompartidoService } from './compartido.service';

@Controller('trabajo-social')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class CompartidoController {
  constructor(private readonly compartidoService: CompartidoService) {}

  @Get('expedientes/:expedienteId/compartido')
  async obtener(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.compartidoService.obtener(expedienteId, contexto);
  }
}
