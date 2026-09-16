import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';
import { DOCUMENTOS_REPOSITORY } from './interfaces/documentos-repository.interface';
import { EXPEDIENTES_REPOSITORY } from './interfaces/expedientes-repository.interface';
import { DocumentosRepository } from './repositories/documentos.repository';
import { ExpedientesRepository } from './repositories/expedientes.repository';

@Module({
  imports: [PrismaModule, AuthModule, AreasModule, StorageModule],
  controllers: [ExpedientesController, DocumentosController],
  providers: [
    ExpedientesService,
    DocumentosService,
    { provide: EXPEDIENTES_REPOSITORY, useClass: ExpedientesRepository },
    { provide: DOCUMENTOS_REPOSITORY, useClass: DocumentosRepository },
  ],
})
export class TrabajoSocialModule {}
