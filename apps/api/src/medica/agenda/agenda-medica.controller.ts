import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  diaAgendaMedicaQuerySchema,
  disponibilidadMedicaQuerySchema,
  programablesMedicaQuerySchema,
  semanaAgendaMedicaQuerySchema,
} from '@akyuam/shared';
import type {
  DiaAgendaMedicaQuery,
  DisponibilidadMedicaQuery,
  ProgramablesMedicaQuery,
  SemanaAgendaMedicaQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AgendaMedicaService } from './agenda-medica.service';

@Controller('medica/agenda')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class AgendaMedicaController {
  constructor(private readonly agendaService: AgendaMedicaService) {}

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
}
