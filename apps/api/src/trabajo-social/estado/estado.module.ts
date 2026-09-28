import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsultaListaTs } from './consulta-lista-ts';
import { EstadoTsService } from './estado-ts.service';
import { ESTADO_AREAS_REPOSITORY } from './interfaces/estado-areas-repository.interface';
import { EstadoAreasRepository } from './repositories/estado-areas.repository';
import { ResolveresEstadoArea } from './resolveres-estado-area';

@Module({
  imports: [PrismaModule],
  providers: [
    EstadoTsService,
    ResolveresEstadoArea,
    ConsultaListaTs,
    { provide: ESTADO_AREAS_REPOSITORY, useClass: EstadoAreasRepository },
  ],
  exports: [EstadoTsService, ResolveresEstadoArea, ConsultaListaTs],
})
export class EstadoModule {}
