import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { LimitePorUsuarioGuard } from '../juridico/compartido/limite-por-usuario.guard';
import { BandejaPsicologiaController } from './bandeja/bandeja-psicologia.controller';
import { BandejaPsicologiaService } from './bandeja/bandeja-psicologia.service';
import { ATENCION_PSICOLOGICA_REPOSITORY } from './interfaces/atencion-psicologica-repository.interface';
import { BANDEJA_PSICOLOGIA_REPOSITORY } from './interfaces/bandeja-psicologia-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from './interfaces/citas-psicologicas-repository.interface';
import { DOCUMENTOS_CITA_REPOSITORY } from './interfaces/documentos-cita-repository.interface';
import { INDICADORES_PSICOLOGIA_REPOSITORY } from './interfaces/indicadores-psicologia-repository.interface';
import { PROCESOS_PSICOLOGIA_REPOSITORY } from './interfaces/procesos-psicologia-repository.interface';
import { AperturaProcesoService } from './procesos/apertura-proceso.service';
import { CierreProcesoService } from './procesos/cierre-proceso.service';
import { ProcesosPsicologiaController } from './procesos/procesos-psicologia.controller';
import { ProcesosPsicologiaService } from './procesos/procesos.service';
import { PsicologiaController } from './psicologia.controller';
import { AtencionPsicologicaRepository } from './repositories/atencion-psicologica.repository';
import { BandejaPsicologiaRepository } from './repositories/bandeja-psicologia.repository';
import { CitasPsicologicasRepository } from './repositories/citas-psicologicas.repository';
import { DocumentosCitaRepository } from './repositories/documentos-cita.repository';
import { IndicadoresPsicologiaRepository } from './repositories/indicadores-psicologia.repository';
import { ProcesosPsicologiaRepository } from './repositories/procesos-psicologia.repository';
import { AccesoPsicologiaService } from './services/acceso-psicologia.service';
import { CitasPsicologicasService } from './services/citas-psicologicas.service';
import { IndicadoresPsicologiaService } from './services/indicadores-psicologia.service';
import { ProcesoPsicologicoService } from './services/proceso-psicologico.service';
import { RegistroConsultaService } from './services/registro-consulta.service';
import { TableroPsicologiaService } from './services/tablero-psicologia.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    // Solo aplica donde un endpoint usa `LimitePorUsuarioGuard`; el tope de cada uno va en
    // su `@Throttle`.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [
    PsicologiaController,
    BandejaPsicologiaController,
    ProcesosPsicologiaController,
  ],
  providers: [
    AccesoPsicologiaService,
    ProcesoPsicologicoService,
    CitasPsicologicasService,
    RegistroConsultaService,
    IndicadoresPsicologiaService,
    TableroPsicologiaService,
    BandejaPsicologiaService,
    AperturaProcesoService,
    CierreProcesoService,
    ProcesosPsicologiaService,
    LimitePorUsuarioGuard,
    {
      provide: BANDEJA_PSICOLOGIA_REPOSITORY,
      useClass: BandejaPsicologiaRepository,
    },
    {
      provide: PROCESOS_PSICOLOGIA_REPOSITORY,
      useClass: ProcesosPsicologiaRepository,
    },
    {
      provide: ATENCION_PSICOLOGICA_REPOSITORY,
      useClass: AtencionPsicologicaRepository,
    },
    {
      provide: CITAS_PSICOLOGICAS_REPOSITORY,
      useClass: CitasPsicologicasRepository,
    },
    {
      provide: DOCUMENTOS_CITA_REPOSITORY,
      useClass: DocumentosCitaRepository,
    },
    {
      provide: INDICADORES_PSICOLOGIA_REPOSITORY,
      useClass: IndicadoresPsicologiaRepository,
    },
  ],
})
export class PsicologiaModule {}
