import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { ExcelJsExportador } from '../common/hoja-calculo/exceljs-exportador';
import { EXPORTADOR_HOJA_CALCULO } from '../common/hoja-calculo/exportador-hoja-calculo.interface';
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
import { AvisosJuridicoListener } from './inicio/avisos-juridico.listener';
import { InicioJuridicoController } from './inicio/inicio-juridico.controller';
import { InicioJuridicoService } from './inicio/inicio-juridico.service';
import { BITACORA_REPOSITORY } from './interfaces/bitacora-repository.interface';
import {
  CARPETAS_REPOSITORY,
  DOCUMENTOS_PROCESO_REPOSITORY,
} from './interfaces/documentos-proceso-repository.interface';
import { INICIO_REPOSITORY } from './interfaces/inicio-repository.interface';
import { PROCESOS_REPOSITORY } from './interfaces/procesos-repository.interface';
import { REFERENCIAS_REPOSITORY } from './interfaces/referencias-repository.interface';
import { REPORTE_PROCESOS_REPOSITORY } from './interfaces/reporte-procesos-repository.interface';
import { REGISTRO_PROCESOS_REPOSITORY } from './interfaces/registro-procesos-repository.interface';
import { TRANSICIONES_REPOSITORY } from './interfaces/transiciones-repository.interface';
import { USUARIAS_JURIDICO_REPOSITORY } from './interfaces/usuarias-repository.interface';
import { ProcesosController } from './procesos/procesos.controller';
import { ProcesosService } from './procesos/procesos.service';
import { RegistroProcesosService } from './procesos/registro-procesos.service';
import { BitacoraRepository } from './repositories/bitacora.repository';
import { CarpetasRepository } from './repositories/carpetas.repository';
import { DocumentosProcesoRepository } from './repositories/documentos-proceso.repository';
import { InicioRepository } from './repositories/inicio.repository';
import { ProcesosRepository } from './repositories/procesos.repository';
import { ReferenciasRepository } from './repositories/referencias.repository';
import { ReporteProcesosRepository } from './repositories/reporte-procesos.repository';
import { RegistroProcesosRepository } from './repositories/registro-procesos.repository';
import { TransicionesRepository } from './repositories/transiciones.repository';
import { UsuariasJuridicoRepository } from './repositories/usuarias-juridico.repository';
import { ReporteProcesosService } from './reportes/reporte-procesos.service';
import { ReportesJuridicoController } from './reportes/reportes-juridico.controller';
import { TransicionesController } from './transiciones/transiciones.controller';
import { TransicionesProcesoService } from './transiciones/transiciones-proceso.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AreasModule,
    StorageModule,
    PersonalModule,
    // Solo aplica donde un endpoint usa `LimitePorUsuarioGuard`; el tope de cada uno va en
    // su `@Throttle`.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [
    InicioJuridicoController,
    BandejaJuridicoController,
    ProcesosController,
    TransicionesController,
    BitacoraController,
    DocumentosProcesoController,
    HistorialUsuariaController,
    ReportesJuridicoController,
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
    InicioJuridicoService,
    AvisosJuridicoListener,
    ReporteProcesosService,
    { provide: EXPORTADOR_HOJA_CALCULO, useClass: ExcelJsExportador },
    {
      provide: REPORTE_PROCESOS_REPOSITORY,
      useClass: ReporteProcesosRepository,
    },
    { provide: INICIO_REPOSITORY, useClass: InicioRepository },
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
