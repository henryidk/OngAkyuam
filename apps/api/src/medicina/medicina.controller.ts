import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  perfilMedicoSchema,
  programarConsultaMedicaSchema,
  registrarConsultaMedicaSchema,
  type PerfilMedico,
  type ProgramarConsultaMedicaInput,
  type RegistrarConsultaMedicaInput,
} from '@akyuam/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MedicinaService } from './medicina.service';

@Controller('medicina')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class MedicinaController {
  constructor(private readonly medicina: MedicinaService) {}
  @Get('workspace')
  workspace(@CurrentUser() usuario: AuthenticatedUser) {
    return this.medicina.workspace(usuario);
  }
  @Post('citas')
  programar(
    @Body(new ZodValidationPipe(programarConsultaMedicaSchema))
    input: ProgramarConsultaMedicaInput,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.medicina.programar(input, usuario);
  }
  @Patch('citas/:id')
  reprogramar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(programarConsultaMedicaSchema))
    input: ProgramarConsultaMedicaInput,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.medicina.programar(input, usuario, id);
  }
  @Post('citas/:id/consulta')
  atender(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(registrarConsultaMedicaSchema))
    input: RegistrarConsultaMedicaInput,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.medicina.atender(id, input, usuario);
  }
  @Post('citas/:id/ausencia')
  ausencia(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.medicina.atender(id, null, usuario);
  }
  @Patch('expedientes/:id/perfil')
  perfil(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(perfilMedicoSchema)) input: PerfilMedico,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.medicina.perfil(id, input, usuario);
  }
}
