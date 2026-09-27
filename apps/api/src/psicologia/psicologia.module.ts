import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ATENCION_PSICOLOGICA_REPOSITORY } from './interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from './interfaces/citas-psicologicas-repository.interface';
import { DOCUMENTOS_CITA_REPOSITORY } from './interfaces/documentos-cita-repository.interface';
import { INDICADORES_PSICOLOGIA_REPOSITORY } from './interfaces/indicadores-psicologia-repository.interface';
import { PsicologiaController } from './psicologia.controller';
import { AtencionPsicologicaRepository } from './repositories/atencion-psicologica.repository';
import { CitasPsicologicasRepository } from './repositories/citas-psicologicas.repository';
import { DocumentosCitaRepository } from './repositories/documentos-cita.repository';
import { IndicadoresPsicologiaRepository } from './repositories/indicadores-psicologia.repository';
import { AccesoPsicologiaService } from './services/acceso-psicologia.service';
import { CitasPsicologicasService } from './services/citas-psicologicas.service';
import { IndicadoresPsicologiaService } from './services/indicadores-psicologia.service';
import { ProcesoPsicologicoService } from './services/proceso-psicologico.service';
import { RegistroConsultaService } from './services/registro-consulta.service';
import { TableroPsicologiaService } from './services/tablero-psicologia.service';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [PsicologiaController],
  providers: [
    AccesoPsicologiaService,
    ProcesoPsicologicoService,
    CitasPsicologicasService,
    RegistroConsultaService,
    IndicadoresPsicologiaService,
    TableroPsicologiaService,
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
