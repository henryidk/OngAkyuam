import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';
import { EXPEDIENTES_REPOSITORY } from './interfaces/expedientes-repository.interface';
import { ExpedientesRepository } from './repositories/expedientes.repository';

// Módulo propio (en vez de vivir dentro de TrabajoSocialModule) para que UsuariasModule pueda
// importar ExpedientesService sin crear una dependencia circular entre ambos.
@Module({
  imports: [PrismaModule, AuthModule, AreasModule],
  controllers: [ExpedientesController],
  providers: [
    ExpedientesService,
    { provide: EXPEDIENTES_REPOSITORY, useClass: ExpedientesRepository },
  ],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
