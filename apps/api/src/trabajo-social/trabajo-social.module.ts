import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { ExcelJsExportador } from '../common/hoja-calculo/exceljs-exportador';
import { EXPORTADOR_HOJA_CALCULO } from '../common/hoja-calculo/exportador-hoja-calculo.interface';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AccesosController } from './accesos/accesos.controller';
import { AccesosService } from './accesos/accesos.service';
import { ACCESOS_REPOSITORY } from './accesos/interfaces/accesos-repository.interface';
import { AccesosRepository } from './accesos/repositories/accesos.repository';
import { AvisosBandejaListener } from './bandeja/avisos-bandeja.listener';
import { BandejaController } from './bandeja/bandeja.controller';
import { BandejaService } from './bandeja/bandeja.service';
import { BANDEJA_REPOSITORY } from './bandeja/interfaces/bandeja-repository.interface';
import { BandejaRepository } from './bandeja/repositories/bandeja.repository';
import { BitacoraController } from './bitacora/bitacora.controller';
import { BitacoraService } from './bitacora/bitacora.service';
import { BITACORA_REPOSITORY } from './bitacora/interfaces/bitacora-repository.interface';
import { BitacoraRepository } from './bitacora/repositories/bitacora.repository';
import { CompartidoController } from './compartido/compartido.controller';
import { CompartidoService } from './compartido/compartido.service';
import { EstrategiasCompartido } from './compartido/estrategias-compartido';
import { COMPARTIDO_REPOSITORY } from './compartido/interfaces/compartido-repository.interface';
import { CompartidoRepository } from './compartido/repositories/compartido.repository';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { EgresoController } from './egreso/egreso.controller';
import { EgresoService } from './egreso/egreso.service';
import { EGRESO_REPOSITORY } from './egreso/interfaces/egreso-repository.interface';
import { EgresoRepository } from './egreso/repositories/egreso.repository';
import { EstadoModule } from './estado/estado.module';
import { ExpedientesModule } from './expedientes.module';
import { DOCUMENTOS_REPOSITORY } from './interfaces/documentos-repository.interface';
import { DocumentosRepository } from './repositories/documentos.repository';
import { REFERIDOS_REPOSITORY } from './referidos/interfaces/referidos-repository.interface';
import { ReferidosController } from './referidos/referidos.controller';
import { ReferidosService } from './referidos/referidos.service';
import { ReferidosRepository } from './referidos/repositories/referidos.repository';
import { REPORTE_POBLACION_REPOSITORY } from './reportes/interfaces/reporte-poblacion-repository.interface';
import { ReportePoblacionService } from './reportes/reporte-poblacion.service';
import { ReportesController } from './reportes/reportes.controller';
import { ReportePoblacionRepository } from './reportes/repositories/reporte-poblacion.repository';
import { UsuariasModule } from './usuarias/usuarias.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    AreasModule,
    ExpedientesModule,
    UsuariasModule,
    EstadoModule,
  ],
  controllers: [
    DocumentosController,
    ReferidosController,
    AccesosController,
    EgresoController,
    CompartidoController,
    BitacoraController,
    BandejaController,
    ReportesController,
  ],
  providers: [
    DocumentosService,
    { provide: DOCUMENTOS_REPOSITORY, useClass: DocumentosRepository },
    ReferidosService,
    { provide: REFERIDOS_REPOSITORY, useClass: ReferidosRepository },
    AccesosService,
    { provide: ACCESOS_REPOSITORY, useClass: AccesosRepository },
    EgresoService,
    { provide: EGRESO_REPOSITORY, useClass: EgresoRepository },
    CompartidoService,
    EstrategiasCompartido,
    { provide: COMPARTIDO_REPOSITORY, useClass: CompartidoRepository },
    BitacoraService,
    { provide: BITACORA_REPOSITORY, useClass: BitacoraRepository },
    BandejaService,
    { provide: BANDEJA_REPOSITORY, useClass: BandejaRepository },
    AvisosBandejaListener,
    ReportePoblacionService,
    {
      provide: REPORTE_POBLACION_REPOSITORY,
      useClass: ReportePoblacionRepository,
    },
    { provide: EXPORTADOR_HOJA_CALCULO, useClass: ExcelJsExportador },
  ],
})
export class TrabajoSocialModule {}
