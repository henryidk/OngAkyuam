import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { InicioJuridicoService } from './inicio-juridico.service';

@Controller('juridico/inicio')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class InicioJuridicoController {
  constructor(private readonly inicioService: InicioJuridicoService) {}

  @Get()
  obtener() {
    return this.inicioService.obtener();
  }
}
