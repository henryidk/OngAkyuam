import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { InicioJuridicoService } from './inicio-juridico.service';

@Controller('juridico/inicio')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class InicioJuridicoController {
  constructor(private readonly inicioService: InicioJuridicoService) {}

  @Get()
  obtener(@CurrentUser() usuario: AuthenticatedUser) {
    return this.inicioService.obtener(usuario.id);
  }
}
