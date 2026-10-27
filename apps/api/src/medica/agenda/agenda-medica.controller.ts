import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  buscarPacientesProgramablesMedicaSchema,
  diaAgendaMedicaQuerySchema,
  disponibilidadMedicaQuerySchema,
  programablesMedicaQuerySchema,
  semanaAgendaMedicaQuerySchema,
} from '@akyuam/shared';
import type {
  BuscarPacientesProgramablesMedicaDatos,
  DiaAgendaMedicaQuery,
  DisponibilidadMedicaQuery,
  ProgramablesMedicaQuery,
  SemanaAgendaMedicaQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PacientesMedicaService } from '../pacientes/pacientes-medica.service';
import { AgendaMedicaService } from './agenda-medica.service';

@Controller('medica/agenda')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class AgendaMedicaController {
  constructor(
    private readonly agendaService: AgendaMedicaService,
    private readonly pacientesService: PacientesMedicaService,
  ) {}

  @Get()
  semana(
    @Query(new ZodValidationPipe(semanaAgendaMedicaQuerySchema))
    query: SemanaAgendaMedicaQuery,
  ) {
    return this.agendaService.semana(query.semana);
  }

  @Get('dia')
  dia(
    @Query(new ZodValidationPipe(diaAgendaMedicaQuerySchema))
    query: DiaAgendaMedicaQuery,
  ) {
    return this.agendaService.dia(query.fecha);
  }

  @Get('disponibilidad')
  disponibilidad(
    @Query(new ZodValidationPipe(disponibilidadMedicaQuerySchema))
    query: DisponibilidadMedicaQuery,
  ) {
    return this.agendaService.disponibilidad(query);
  }

  @Get('programables')
  programables(
    @Query(new ZodValidationPipe(programablesMedicaQuerySchema))
    query: ProgramablesMedicaQuery,
  ) {
    return this.agendaService.programables(query);
  }

  /**
   * Buscador de pacientes de los modales. Es POST de solo lectura porque `q` puede ser el nombre
   * de una sobreviviente: en el cuerpo no queda en logs de acceso ni en el historial del
   * navegador. El límite por usuario acota recorrer la lista de nombres a fuerza de peticiones.
   */
  @Post('programables/busqueda')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  buscarProgramables(
    @Body(new ZodValidationPipe(buscarPacientesProgramablesMedicaSchema))
    datos: BuscarPacientesProgramablesMedicaDatos,
  ) {
    return this.pacientesService.buscarProgramables(datos);
  }
}
