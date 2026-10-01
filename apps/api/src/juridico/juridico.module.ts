import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { PersonalModule } from '../personal/personal.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { BandejaJuridicoController } from './bandeja/bandeja-juridico.controller';
import { BandejaJuridicoService } from './bandeja/bandeja-juridico.service';
import { BitacoraController } from './bitacora/bitacora.controller';
import { BitacoraService } from './bitacora/bitacora.service';
import { AccesoJuridicoService } from './compartido/acceso-juridico.service';
import { AsignacionPersonalService } from './compartido/asignacion-personal.service';
import { LimitePorUsuarioGuard } from './compartido/limite-por-usuario.guard';
import { DocumentosProcesoController } from './documentos/documentos-proceso.controller';
import { DocumentosProcesoService } from './documentos/documentos-proceso.service';
import { HistorialUsuariaController } from './historial/historial-usuaria.controller';
import { HistorialUsuariaService } from './historial/historial-usuaria.service';
import { BITACORA_REPOSITORY } from './interfaces/bitacora-repository.interface';
import {
  CARPETAS_REPOSITORY,
  DOCUMENTOS_PROCESO_REPOSITORY,
} from './interfaces/documentos-proceso-repository.interface';
import { PROCESOS_REPOSITORY } from './interfaces/procesos-repository.interface';
import { REFERENCIAS_REPOSITORY } from './interfaces/referencias-repository.interface';
import { REGISTRO_PROCESOS_REPOSITORY } from './interfaces/registro-procesos-repository.interface';
import { TRANSICIONES_REPOSITORY } from './interfaces/transiciones-repository.interface';
import { USUARIAS_JURIDICO_REPOSITORY } from './interfaces/usuarias-repository.interface';
import { ProcesosController } from './procesos/procesos.controller';
import { ProcesosService } from './procesos/procesos.service';
import { RegistroProcesosService } from './procesos/registro-procesos.service';
import { BitacoraRepository } from './repositories/bitacora.repository';
import { CarpetasRepository } from './repositories/carpetas.repository';
import { DocumentosProcesoRepository } from './repositories/documentos-proceso.repository';
import { ProcesosRepository } from './repositories/procesos.repository';
import { ReferenciasRepository } from './repositories/referencias.repository';
import { RegistroProcesosRepository } from './repositories/registro-procesos.repository';
import { TransicionesRepository } from './repositories/transiciones.repository';
import { UsuariasJuridicoRepository } from './repositories/usuarias-juridico.repository';
import { TransicionesController } from './transiciones/transiciones.controller';
import { TransicionesProcesoService } from './transiciones/transiciones-proceso.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    PersonalModule,
    // Solo aplica donde un endpoint usa `LimitePorUsuarioGuard`; el tope de cada uno va en
    // su `@Throttle`.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [
    BandejaJuridicoController,
    ProcesosController,
    TransicionesController,
    BitacoraController,
    DocumentosProcesoController,
    HistorialUsuariaController,
  ],
  providers: [
    AccesoJuridicoService,
    AsignacionPersonalService,
    LimitePorUsuarioGuard,
    BandejaJuridicoService,
    ProcesosService,
    RegistroProcesosService,
    TransicionesProcesoService,
    BitacoraService,
    DocumentosProcesoService,
    HistorialUsuariaService,
    { provide: PROCESOS_REPOSITORY, useClass: ProcesosRepository },
    {
      provide: REGISTRO_PROCESOS_REPOSITORY,
      useClass: RegistroProcesosRepository,
    },
    { provide: TRANSICIONES_REPOSITORY, useClass: TransicionesRepository },
    { provide: BITACORA_REPOSITORY, useClass: BitacoraRepository },
    { provide: CARPETAS_REPOSITORY, useClass: CarpetasRepository },
    {
      provide: DOCUMENTOS_PROCESO_REPOSITORY,
      useClass: DocumentosProcesoRepository,
    },
    { provide: REFERENCIAS_REPOSITORY, useClass: ReferenciasRepository },
    {
      provide: USUARIAS_JURIDICO_REPOSITORY,
      useClass: UsuariasJuridicoRepository,
    },
  ],
})
export class JuridicoModule {}
