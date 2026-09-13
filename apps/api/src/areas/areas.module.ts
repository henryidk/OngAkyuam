import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { AreasGateway } from './gateways/areas.gateway';
import { AREA_NOTIFIER } from './interfaces/area-notifier.interface';
import { AREAS_REPOSITORY } from './interfaces/areas-repository.interface';
import { AreasRepository } from './repositories/areas.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AreasController],
  providers: [
    AreasService,
    { provide: AREAS_REPOSITORY, useClass: AreasRepository },
    AreasGateway,
    { provide: AREA_NOTIFIER, useExisting: AreasGateway },
  ],
  exports: [AREA_NOTIFIER],
})
export class AreasModule {}
