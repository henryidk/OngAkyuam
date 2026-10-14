import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BandejaMedicaService } from './bandeja-medica.service';

/** Área de atención y contadores del menú lateral. */
@Controller('medica')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class BandejaMedicaController {
  constructor(private readonly bandejaService: BandejaMedicaService) {}

  @Get('bandeja')
  pendientes() {
    return this.bandejaService.pendientes();
  }

  @Get('contadores')
  contadores() {
    return this.bandejaService.contadores();
  }
}
