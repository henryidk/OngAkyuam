import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ExcelJsExportador } from '../common/hoja-calculo/exceljs-exportador';
import { EXPORTADOR_HOJA_CALCULO } from '../common/hoja-calculo/exportador-hoja-calculo.interface';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { LimitePorUsuarioGuard } from '../juridico/compartido/limite-por-usuario.guard';
import { AgendaPsicologiaController } from './agenda/agenda-psicologia.controller';
import { AgendaPsicologiaService } from './agenda/agenda-psicologia.service';
import { AvisosPsicologiaListener } from './bandeja/avisos-psicologia.listener';
import { BandejaPsicologiaController } from './bandeja/bandeja-psicologia.controller';
import { BandejaPsicologiaService } from './bandeja/bandeja-psicologia.service';
import { AGENDA_PSICOLOGIA_REPOSITORY } from './interfaces/agenda-psicologia-repository.interface';
import { ATENCION_PSICOLOGICA_REPOSITORY } from './interfaces/atencion-psicologica-repository.interface';
import { BANDEJA_PSICOLOGIA_REPOSITORY } from './interfaces/bandeja-psicologia-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from './interfaces/citas-psicologicas-repository.interface';
import { CONSULTAS_PROCESOS_REPOSITORY } from './interfaces/consultas-procesos-repository.interface';
import { DOCUMENTOS_CITA_REPOSITORY } from './interfaces/documentos-cita-repository.interface';
import { PROCESOS_PSICOLOGIA_REPOSITORY } from './interfaces/procesos-psicologia-repository.interface';
import { USUARIAS_PSICOLOGIA_REPOSITORY } from './interfaces/usuarias-psicologia-repository.interface';
import { AperturaProcesoService } from './procesos/apertura-proceso.service';
import { CierreProcesoService } from './procesos/cierre-proceso.service';
import { ConsultasProcesosService } from './procesos/consultas-procesos.service';
import { ProcesosPsicologiaController } from './procesos/procesos-psicologia.controller';
import { ProcesosPsicologiaService } from './procesos/procesos.service';
import { PsicologiaController } from './psicologia.controller';
import { AgendaPsicologiaRepository } from './repositories/agenda-psicologia.repository';
import { AtencionPsicologicaRepository } from './repositories/atencion-psicologica.repository';
import { BandejaPsicologiaRepository } from './repositories/bandeja-psicologia.repository';
import { CitasPsicologicasRepository } from './repositories/citas-psicologicas.repository';
import { ConsultasProcesosRepository } from './repositories/consultas-procesos.repository';
import { DocumentosCitaRepository } from './repositories/documentos-cita.repository';
import { ProcesosPsicologiaRepository } from './repositories/procesos-psicologia.repository';
import { UsuariasPsicologiaRepository } from './repositories/usuarias-psicologia.repository';
import { AccesoPsicologiaService } from './services/acceso-psicologia.service';
import { CitasPsicologicasService } from './services/citas-psicologicas.service';
import { IndicadoresPsicologiaService } from './services/indicadores-psicologia.service';
import { RegistroConsultaService } from './services/registro-consulta.service';
import { UsuariasPsicologiaController } from './usuarias/usuarias-psicologia.controller';
import { UsuariasPsicologiaService } from './usuarias/usuarias-psicologia.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AreasModule,
    StorageModule,
    // Solo aplica donde un endpoint usa `LimitePorUsuarioGuard`; el tope de cada uno va en
    // su `@Throttle`.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [
    PsicologiaController,
    BandejaPsicologiaController,
    ProcesosPsicologiaController,
    UsuariasPsicologiaController,
    AgendaPsicologiaController,
  ],
  providers: [
    AccesoPsicologiaService,
    CitasPsicologicasService,
    RegistroConsultaService,
    IndicadoresPsicologiaService,
    BandejaPsicologiaService,
    AvisosPsicologiaListener,
    AperturaProcesoService,
    CierreProcesoService,
    ProcesosPsicologiaService,
    ConsultasProcesosService,
    UsuariasPsicologiaService,
    AgendaPsicologiaService,
    LimitePorUsuarioGuard,
    { provide: EXPORTADOR_HOJA_CALCULO, useClass: ExcelJsExportador },
    {
      provide: BANDEJA_PSICOLOGIA_REPOSITORY,
      useClass: BandejaPsicologiaRepository,
    },
    {
      provide: PROCESOS_PSICOLOGIA_REPOSITORY,
      useClass: ProcesosPsicologiaRepository,
    },
    {
      provide: CONSULTAS_PROCESOS_REPOSITORY,
      useClass: ConsultasProcesosRepository,
    },
    {
      provide: USUARIAS_PSICOLOGIA_REPOSITORY,
      useClass: UsuariasPsicologiaRepository,
    },
    {
      provide: AGENDA_PSICOLOGIA_REPOSITORY,
      useClass: AgendaPsicologiaRepository,
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
  ],
})
export class PsicologiaModule {}
