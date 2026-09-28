import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EstadoTsService } from './estado-ts.service';
import { ESTADO_AREAS_REPOSITORY } from './interfaces/estado-areas-repository.interface';
import { EstadoAreasRepository } from './repositories/estado-areas.repository';
import { ResolveresEstadoArea } from './resolveres-estado-area';

@Module({
  imports: [PrismaModule],
  providers: [
    EstadoTsService,
    ResolveresEstadoArea,
    { provide: ESTADO_AREAS_REPOSITORY, useClass: EstadoAreasRepository },
  ],
  exports: [EstadoTsService, ResolveresEstadoArea],
})
export class EstadoModule {}
