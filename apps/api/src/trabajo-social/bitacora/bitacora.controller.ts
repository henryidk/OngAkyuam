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
import { BitacoraService } from './bitacora.service';

@Controller('trabajo-social/usuarias/:id/bitacora')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Get()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bitacoraService.obtener(id, contexto);
  }
}
