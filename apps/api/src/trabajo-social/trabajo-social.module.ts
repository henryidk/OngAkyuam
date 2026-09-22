import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { ExpedientesModule } from './expedientes.module';
import { DOCUMENTOS_REPOSITORY } from './interfaces/documentos-repository.interface';
import { DocumentosRepository } from './repositories/documentos.repository';
import { UsuariasModule } from './usuarias/usuarias.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    ExpedientesModule,
    UsuariasModule,
  ],
  controllers: [DocumentosController],
  providers: [
    DocumentosService,
    { provide: DOCUMENTOS_REPOSITORY, useClass: DocumentosRepository },
  ],
})
export class TrabajoSocialModule {}
