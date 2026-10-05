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
  listarUsuariasJuridicoQuerySchema,
  type ListarUsuariasJuridicoQuery,
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

  // Con límite: junto a la paginación, evita recorrer la base de usuarias a fuerza de
  // búsquedas o de pasar páginas.
  @Get()
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listar(
    @Query(new ZodValidationPipe(listarUsuariasJuridicoQuerySchema))
    query: ListarUsuariasJuridicoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.historialService.listar(query, contexto);
  }

  @Get(':usuariaId')
  obtener(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.historialService.obtener(usuariaId, contexto);
  }
}
