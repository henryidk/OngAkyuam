import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpedientesModule } from '../expedientes.module';
import { USUARIAS_REPOSITORY } from './interfaces/usuarias-repository.interface';
import { UsuariasRepository } from './repositories/usuarias.repository';
import { UsuariasController } from './usuarias.controller';
import { UsuariasService } from './usuarias.service';

@Module({
  imports: [PrismaModule, AuthModule, ExpedientesModule],
  controllers: [UsuariasController],
  providers: [
    UsuariasService,
    { provide: USUARIAS_REPOSITORY, useClass: UsuariasRepository },
  ],
  exports: [UsuariasService],
})
export class UsuariasModule {}
