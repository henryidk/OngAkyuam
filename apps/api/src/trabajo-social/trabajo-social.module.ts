import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AccesosController } from './accesos/accesos.controller';
import { AccesosService } from './accesos/accesos.service';
import { ACCESOS_REPOSITORY } from './accesos/interfaces/accesos-repository.interface';
import { AccesosRepository } from './accesos/repositories/accesos.repository';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { ExpedientesModule } from './expedientes.module';
import { DOCUMENTOS_REPOSITORY } from './interfaces/documentos-repository.interface';
import { DocumentosRepository } from './repositories/documentos.repository';
import { REFERIDOS_REPOSITORY } from './referidos/interfaces/referidos-repository.interface';
import { ReferidosController } from './referidos/referidos.controller';
import { ReferidosService } from './referidos/referidos.service';
import { ReferidosRepository } from './referidos/repositories/referidos.repository';
import { UsuariasModule } from './usuarias/usuarias.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    AreasModule,
    ExpedientesModule,
    UsuariasModule,
  ],
  controllers: [DocumentosController, ReferidosController, AccesosController],
  providers: [
    DocumentosService,
    { provide: DOCUMENTOS_REPOSITORY, useClass: DocumentosRepository },
    ReferidosService,
    { provide: REFERIDOS_REPOSITORY, useClass: ReferidosRepository },
    AccesosService,
    { provide: ACCESOS_REPOSITORY, useClass: AccesosRepository },
  ],
})
export class TrabajoSocialModule {}
