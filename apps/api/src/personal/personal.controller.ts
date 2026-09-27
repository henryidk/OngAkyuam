import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AREAS_ATENCION,
  crearPersonalSchema,
  editarPersonalSchema,
  listarPersonalQuerySchema,
  type CrearPersonalInput,
  type EditarPersonalInput,
  type ListarPersonalQuery,
} from '@akyuam/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ContextoAuditoria } from '../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PersonalService } from './personal.service';

@Controller('personal')
@UseGuards(RolesGuard)
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  // Accesible a las áreas de atención (para poblar sus propios selects, ej. abogada/
  // procuradora en jurídico) y a Administración (para la pantalla de gestión de personal).
  @Get()
  @Roles(...AREAS_ATENCION, 'ADMINISTRACION')
  listar(
    @Query(new ZodValidationPipe(listarPersonalQuerySchema))
    query: ListarPersonalQuery,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.personalService.listar(usuario, query);
  }

  @Post()
  @Roles('ADMINISTRACION')
  crear(
    @Body(new ZodValidationPipe(crearPersonalSchema)) datos: CrearPersonalInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.personalService.crear(datos, contexto);
  }

  // Sin DELETE: se desactiva, nunca se borra, para no romper el historial de procesos ya
  // asociados a esta persona (ver planjuridico.md, punto 5).
  @Patch(':id')
  @Roles('ADMINISTRACION')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarPersonalSchema))
    datos: EditarPersonalInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.personalService.editar(id, datos, contexto);
  }
}
