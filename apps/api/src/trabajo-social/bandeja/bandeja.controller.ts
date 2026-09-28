import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { BandejaService } from './bandeja.service';

@Controller('trabajo-social/bandeja')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class BandejaController {
  constructor(private readonly bandejaService: BandejaService) {}

  @Get()
  async obtener(@ContextoAuditoria() contexto: IContextoAuditoria) {
    return this.bandejaService.obtener(contexto);
  }
}
