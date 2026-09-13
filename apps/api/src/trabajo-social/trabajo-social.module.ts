import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';
import { EXPEDIENTES_REPOSITORY } from './interfaces/expedientes-repository.interface';
import { ExpedientesRepository } from './repositories/expedientes.repository';

@Module({
  imports: [PrismaModule, AuthModule, AreasModule],
  controllers: [ExpedientesController],
  providers: [
    ExpedientesService,
    { provide: EXPEDIENTES_REPOSITORY, useClass: ExpedientesRepository },
  ],
})
export class TrabajoSocialModule {}
