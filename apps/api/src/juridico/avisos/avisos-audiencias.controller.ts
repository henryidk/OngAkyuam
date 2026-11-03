import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AvisosAudienciasService } from './avisos-audiencias.service';

@Controller('juridico/avisos')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class AvisosAudienciasController {
  constructor(private readonly avisos: AvisosAudienciasService) {}

  // Lleva nombres de usuarias: `no-store` evita que el navegador o un proxy guarden una copia.
  @Get('audiencias')
  @Header('Cache-Control', 'no-store')
  audiencias() {
    return this.avisos.obtener();
  }
}
