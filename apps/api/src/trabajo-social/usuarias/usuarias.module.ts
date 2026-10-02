import { Module } from '@nestjs/common';
import { AreasModule } from '../../areas/areas.module';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EstadoModule } from '../estado/estado.module';
import { ExpedientesModule } from '../expedientes.module';
import { USUARIAS_REPOSITORY } from './interfaces/usuarias-repository.interface';
import { UsuariasRepository } from './repositories/usuarias.repository';
import { UsuariasController } from './usuarias.controller';
import { UsuariasService } from './usuarias.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExpedientesModule,
    EstadoModule,
    AreasModule,
  ],
  controllers: [UsuariasController],
  providers: [
    UsuariasService,
    { provide: USUARIAS_REPOSITORY, useClass: UsuariasRepository },
  ],
  exports: [UsuariasService],
})
export class UsuariasModule {}
