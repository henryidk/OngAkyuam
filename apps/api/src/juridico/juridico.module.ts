import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonalModule } from '../personal/personal.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DOCUMENTOS_PROCESO_REPOSITORY } from './interfaces/documentos-proceso-repository.interface';
import { NOTAS_AVANCE_REPOSITORY } from './interfaces/notas-avance-repository.interface';
import { PROCESOS_JURIDICOS_REPOSITORY } from './interfaces/procesos-juridicos-repository.interface';
import { JuridicoController } from './juridico.controller';
import { JuridicoService } from './juridico.service';
import { DocumentosProcesoRepository } from './repositories/documentos-proceso.repository';
import { NotasAvanceRepository } from './repositories/notas-avance.repository';
import { ProcesosJuridicosRepository } from './repositories/procesos-juridicos.repository';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, PersonalModule],
  controllers: [JuridicoController],
  providers: [
    JuridicoService,
    {
      provide: PROCESOS_JURIDICOS_REPOSITORY,
      useClass: ProcesosJuridicosRepository,
    },
    { provide: NOTAS_AVANCE_REPOSITORY, useClass: NotasAvanceRepository },
    {
      provide: DOCUMENTOS_PROCESO_REPOSITORY,
      useClass: DocumentosProcesoRepository,
    },
  ],
})
export class JuridicoModule {}
