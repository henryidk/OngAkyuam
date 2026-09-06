import { Module } from '@nestjs/common';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';

@Module({
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
})
export class ExpedientesModule {}
