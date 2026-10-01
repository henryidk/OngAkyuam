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
  buscarUsuariasJuridicoQuerySchema,
  type BuscarUsuariasJuridicoQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../compartido/limite-por-usuario.guard';
import { HistorialUsuariaService } from './historial-usuaria.service';

@Controller('juridico/usuarias')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class HistorialUsuariaController {
  constructor(private readonly historialService: HistorialUsuariaService) {}

  // Con límite: junto al tope de resultados, evita recorrer la base de usuarias a fuerza
  // de búsquedas.
  @Get()
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  buscar(
    @Query(new ZodValidationPipe(buscarUsuariasJuridicoQuerySchema))
    query: BuscarUsuariasJuridicoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.historialService.buscar(query.q, contexto);
  }

  @Get(':usuariaId')
  obtener(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.historialService.obtener(usuariaId, contexto);
  }
}
