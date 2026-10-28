import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BandejaJuridicoService } from './bandeja-juridico.service';

@Controller('juridico/bandeja')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class BandejaJuridicoController {
  constructor(private readonly bandejaService: BandejaJuridicoService) {}

  @Get()
  listar() {
    return this.bandejaService.listar();
  }
}
