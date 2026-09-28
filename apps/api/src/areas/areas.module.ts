import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { AreasGateway } from './gateways/areas.gateway';
import { AREA_NOTIFIER } from './interfaces/area-notifier.interface';
import { AREAS_REPOSITORY } from './interfaces/areas-repository.interface';
import { PoliticasAcceso } from './politicas/politicas-acceso';
import { AreasRepository } from './repositories/areas.repository';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AreasController],
  providers: [
    AreasService,
    { provide: AREAS_REPOSITORY, useClass: AreasRepository },
    AreasGateway,
    { provide: AREA_NOTIFIER, useExisting: AreasGateway },
    PoliticasAcceso,
  ],
  exports: [AREA_NOTIFIER, PoliticasAcceso],
})
export class AreasModule {}
