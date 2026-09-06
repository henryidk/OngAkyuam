import { Module } from '@nestjs/common';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';

import { ExpedientesGateway } from './expedientes.gateway';

@Module({
  controllers: [ExpedientesController],
  providers: [ExpedientesService, ExpedientesGateway],
})
export class ExpedientesModule {}
