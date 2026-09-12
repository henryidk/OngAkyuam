import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { AREAS_REPOSITORY } from './interfaces/areas-repository.interface';
import { AreasRepository } from './repositories/areas.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AreasController],
  providers: [
    AreasService,
    { provide: AREAS_REPOSITORY, useClass: AreasRepository },
  ],
})
export class AreasModule {}
