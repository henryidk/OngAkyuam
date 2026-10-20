import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ExcelJsExportador } from '../common/hoja-calculo/exceljs-exportador';
import { EXPORTADOR_HOJA_CALCULO } from '../common/hoja-calculo/exportador-hoja-calculo.interface';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { LimitePorUsuarioGuard } from '../juridico/compartido/limite-por-usuario.guard';
import { AgendaMedicaController } from './agenda/agenda-medica.controller';
import { AgendaMedicaService } from './agenda/agenda-medica.service';
import { AltaAtencionService } from './atenciones/alta-atencion.service';
import { AtencionesMedicasController } from './atenciones/atenciones-medicas.controller';
import { VisibilidadService } from './atenciones/visibilidad.service';
import { BandejaMedicaController } from './bandeja/bandeja-medica.controller';
import { BandejaMedicaService } from './bandeja/bandeja-medica.service';
import { CitasMedicasController } from './citas/citas-medicas.controller';
import { InasistenciaService } from './citas/inasistencia.service';
import { ProgramacionCitaService } from './citas/programacion-cita.service';
import { AccesoMedicaService } from './compartido/acceso-medica.service';
import { IdempotenciaMedica } from './compartido/idempotencia';
import { RELOJ, RelojSistema } from '../common/reloj';
import { ConsultasMedicasController } from './consultas/consultas-medicas.controller';
import { ConsultasMedicasService } from './consultas/consultas-medicas.service';
import { RegistroConsultaService } from './consultas/registro-consulta.service';
import { DocumentosMedicosController } from './documentos/documentos-medicos.controller';
import { DocumentosMedicosService } from './documentos/documentos-medicos.service';
import { LimpiezaDocumentosMedicosService } from './documentos/limpieza-documentos-medicos.service';
import { ACCESO_MEDICA_REPOSITORY } from './interfaces/acceso-medica-repository.interface';
import { AGENDA_MEDICA_REPOSITORY } from './interfaces/agenda-medica-repository.interface';
import { ATENCIONES_MEDICAS_REPOSITORY } from './interfaces/atenciones-medicas-repository.interface';
import { CITAS_MEDICAS_REPOSITORY } from './interfaces/citas-medicas-repository.interface';
import { CONSULTAS_MEDICAS_REPOSITORY } from './interfaces/consultas-medicas-repository.interface';
import { DOCUMENTOS_MEDICOS_REPOSITORY } from './interfaces/documentos-medicos-repository.interface';
import { PACIENTES_MEDICA_REPOSITORY } from './interfaces/pacientes-medica-repository.interface';
import { REPORTES_MEDICA_REPOSITORY } from './interfaces/reportes-medica-repository.interface';
import { PacientesMedicaController } from './pacientes/pacientes-medica.controller';
import { PacientesMedicaService } from './pacientes/pacientes-medica.service';
import { IndicadoresMedicaService } from './reportes/indicadores-medica.service';
import { ReportesMedicaController } from './reportes/reportes-medica.controller';
import { AccesoMedicaRepository } from './repositories/acceso-medica.repository';
import { AgendaMedicaRepository } from './repositories/agenda-medica.repository';
import { AtencionesMedicasRepository } from './repositories/atenciones-medicas.repository';
import { CitasMedicasRepository } from './repositories/citas-medicas.repository';
import { ConsultasMedicasRepository } from './repositories/consultas-medicas.repository';
import { DocumentosMedicosRepository } from './repositories/documentos-medicos.repository';
import { PacientesMedicaRepository } from './repositories/pacientes-medica.repository';
import { ReportesMedicaRepository } from './repositories/reportes-medica.repository';

import { VISIBILIDAD_MEDICA_READER } from './interfaces/visibilidad-medica-reader.interface';
import { VisibilidadMedicaReader } from './visibilidad/visibilidad-medica.reader';

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
    BandejaMedicaController,
    AgendaMedicaController,
    CitasMedicasController,
    ConsultasMedicasController,
    DocumentosMedicosController,
    AtencionesMedicasController,
    PacientesMedicaController,
    ReportesMedicaController,
  ],
  providers: [
    LimitePorUsuarioGuard,
    IdempotenciaMedica,
    AccesoMedicaService,
    BandejaMedicaService,
    AgendaMedicaService,
    ProgramacionCitaService,
    InasistenciaService,
    RegistroConsultaService,
    ConsultasMedicasService,
    DocumentosMedicosService,
    LimpiezaDocumentosMedicosService,
    AltaAtencionService,
    VisibilidadService,
    PacientesMedicaService,
    IndicadoresMedicaService,
    { provide: RELOJ, useClass: RelojSistema },
    { provide: EXPORTADOR_HOJA_CALCULO, useClass: ExcelJsExportador },
    { provide: ACCESO_MEDICA_REPOSITORY, useClass: AccesoMedicaRepository },
    { provide: CITAS_MEDICAS_REPOSITORY, useClass: CitasMedicasRepository },
    {
      provide: CONSULTAS_MEDICAS_REPOSITORY,
      useClass: ConsultasMedicasRepository,
    },
    {
      provide: ATENCIONES_MEDICAS_REPOSITORY,
      useClass: AtencionesMedicasRepository,
    },
    {
      provide: DOCUMENTOS_MEDICOS_REPOSITORY,
      useClass: DocumentosMedicosRepository,
    },
    { provide: AGENDA_MEDICA_REPOSITORY, useClass: AgendaMedicaRepository },
    {
      provide: PACIENTES_MEDICA_REPOSITORY,
      useClass: PacientesMedicaRepository,
    },
    { provide: REPORTES_MEDICA_REPOSITORY, useClass: ReportesMedicaRepository },
    { provide: VISIBILIDAD_MEDICA_READER, useClass: VisibilidadMedicaReader },
  ],
  // Jurídico y Psicología leen lo que Medicina les comparte solo por esta interfaz.
  exports: [VISIBILIDAD_MEDICA_READER],
})
export class MedicaModule {}
