import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  consultasPacienteMedicaQuerySchema,
  listarPacientesMedicaQuerySchema,
} from '@akyuam/shared';
import type {
  ConsultasPacienteMedicaQuery,
  ListarPacientesMedicaQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { ConsultasMedicasService } from '../consultas/consultas-medicas.service';
import { DocumentosMedicosService } from '../documentos/documentos-medicos.service';
import { PacientesMedicaService } from './pacientes-medica.service';

@Controller('medica/pacientes')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class PacientesMedicaController {
  constructor(
    private readonly pacientesService: PacientesMedicaService,
    private readonly consultasService: ConsultasMedicasService,
    private readonly documentosService: DocumentosMedicosService,
  ) {}

  /** Búsqueda por nombre, DPI o expediente: limitada por usuario para frenar barridos. */
  @Get()
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listar(
    @Query(new ZodValidationPipe(listarPacientesMedicaQuerySchema))
    query: ListarPacientesMedicaQuery,
  ) {
    return this.pacientesService.listar(query);
  }

  @Get(':usuariaId')
  ficha(@Param('usuariaId', ParseUUIDPipe) usuariaId: string) {
    return this.pacientesService.ficha(usuariaId);
  }

  @Get(':usuariaId/consultas')
  historia(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @Query(new ZodValidationPipe(consultasPacienteMedicaQuerySchema))
    query: ConsultasPacienteMedicaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.consultasService.historia(usuariaId, query, contexto);
  }

  @Get(':usuariaId/documentos')
  documentos(@Param('usuariaId', ParseUUIDPipe) usuariaId: string) {
    return this.documentosService.listarPorUsuaria(usuariaId);
  }
}
