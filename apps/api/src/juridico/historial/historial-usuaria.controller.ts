import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  buscarUsuariasJuridicoSchema,
  type BuscarUsuariasJuridicoDatos,
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

  // POST de solo lectura: `q` es un nombre, DPI o expediente y en el cuerpo no queda en logs de
  // acceso ni en el historial del navegador. Con límite: junto a la paginación, evita recorrer la
  // base de usuarias a fuerza de búsquedas o de pasar páginas.
  @Post('busqueda')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listar(
    @Body(new ZodValidationPipe(buscarUsuariasJuridicoSchema))
    query: BuscarUsuariasJuridicoDatos,
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
