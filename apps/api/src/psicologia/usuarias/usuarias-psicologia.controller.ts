import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  abrirProcesosPsicologiaSchema,
  listarUsuariasPsicologiaQuerySchema,
} from '@akyuam/shared';
import type {
  AbrirProcesosPsicologiaInput,
  ListarUsuariasPsicologiaQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { AperturaProcesoService } from '../procesos/apertura-proceso.service';
import { UsuariasPsicologiaService } from './usuarias-psicologia.service';

@Controller('psicologia/usuarias')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class UsuariasPsicologiaController {
  constructor(
    private readonly usuariasService: UsuariasPsicologiaService,
    private readonly aperturaService: AperturaProcesoService,
  ) {}

  /**
   * Lista de trabajo. Es POST de solo lectura porque `q` puede ser el nombre o el DPI de una
   * sobreviviente: en el cuerpo no queda en logs de acceso ni en el historial del navegador.
   */
  @Post('busqueda')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listar(
    @Body(new ZodValidationPipe(listarUsuariasPsicologiaQuerySchema))
    query: ListarUsuariasPsicologiaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariasService.listar(query, contexto);
  }

  @Get(':usuariaId')
  obtener(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.usuariasService.obtener(usuariaId, contexto);
  }

  @Post(':usuariaId/procesos')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  abrirProceso(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @Body(new ZodValidationPipe(abrirProcesosPsicologiaSchema))
    datos: AbrirProcesosPsicologiaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('idempotency-key') claveIdempotencia?: string,
  ) {
    return this.aperturaService.abrirDesdeFicha(
      usuariaId,
      datos,
      contexto,
      claveIdempotencia,
    );
  }
}
