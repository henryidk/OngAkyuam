import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { BandejaMedicaService } from './bandeja-medica.service';

/** Área de atención y contadores del menú lateral. */
@Controller('medica')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class BandejaMedicaController {
  constructor(private readonly bandejaService: BandejaMedicaService) {}

  @Get('bandeja')
  pendientes(@CurrentUser() usuario: AuthenticatedUser) {
    return this.bandejaService.pendientes(usuario.id);
  }

  /**
   * Reserva o renueva la referencia mientras se agenda la primera consulta; la pantalla abierta
   * la llama cada pocos segundos. Ni reservar ni liberar se auditan: no tocan el caso.
   */
  @Post('bandeja/:referidoId/reserva')
  @HttpCode(204)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  reservar(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.bandejaService.reservar(referidoId, usuario);
  }

  @Delete('bandeja/:referidoId/reserva')
  @HttpCode(204)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  liberar(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.bandejaService.liberar(referidoId, usuario.id);
  }

  @Get('contadores')
  contadores() {
    return this.bandejaService.contadores();
  }
}
