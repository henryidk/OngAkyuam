import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ATENCION_PSICOLOGICA_REPOSITORY } from './interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from './interfaces/citas-psicologicas-repository.interface';
import { PsicologiaController } from './psicologia.controller';
import { PsicologiaService } from './psicologia.service';
import { AtencionPsicologicaRepository } from './repositories/atencion-psicologica.repository';
import { CitasPsicologicasRepository } from './repositories/citas-psicologicas.repository';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [PsicologiaController],
  providers: [
    PsicologiaService,
    {
      provide: ATENCION_PSICOLOGICA_REPOSITORY,
      useClass: AtencionPsicologicaRepository,
    },
    {
      provide: CITAS_PSICOLOGICAS_REPOSITORY,
      useClass: CitasPsicologicasRepository,
    },
  ],
})
export class PsicologiaModule {}
