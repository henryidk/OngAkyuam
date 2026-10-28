import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  asignarNumeroJudicialSchema,
  buscarProcesosSchema,
  crearProcesosEnLoteSchema,
  editarDatosProcesoSchema,
  type AsignarNumeroJudicialInput,
  type BuscarProcesosDatos,
  type CrearProcesosEnLoteInput,
  type EditarDatosProcesoInput,
} from '@akyuam/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../compartido/limite-por-usuario.guard';
import { NumeroJudicialService } from './numero-judicial.service';
import { ProcesosService } from './procesos.service';
import { RegistroProcesosService } from './registro-procesos.service';

@Controller('juridico')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class ProcesosController {
  constructor(
    private readonly procesosService: ProcesosService,
    private readonly registroService: RegistroProcesosService,
    private readonly numeroJudicialService: NumeroJudicialService,
  ) {}

  /**
   * Lista de trabajo. Es POST de solo lectura porque `q` puede ser el nombre de una sobreviviente:
   * en el cuerpo no queda en logs de acceso ni en el historial del navegador.
   */
  @Post('procesos/busqueda')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listar(
    @Body(new ZodValidationPipe(buscarProcesosSchema))
    datos: BuscarProcesosDatos,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.procesosService.listar(datos, usuario.id);
  }

  // Antes que `procesos/:procesoId`: si no, "resumen" se leería como un id.
  @Get('procesos/resumen')
  resumen() {
    return this.procesosService.resumen();
  }

  @Get('procesos/:procesoId')
  obtenerDetalle(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.procesosService.obtenerDetalle(procesoId, contexto);
  }

  @Patch('procesos/:procesoId/datos')
  @HttpCode(HttpStatus.NO_CONTENT)
  editarDatos(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(editarDatosProcesoSchema))
    datos: EditarDatosProcesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.procesosService.editarDatos(procesoId, datos, contexto);
  }

  @Patch('procesos/:procesoId/numero-judicial')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  asignarNumeroJudicial(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(asignarNumeroJudicialSchema))
    datos: AsignarNumeroJudicialInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.numeroJudicialService.asignar(procesoId, datos, contexto);
  }

  @Get('expedientes/:expedienteId/registro-contexto')
  obtenerContextoRegistro(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
  ) {
    return this.registroService.obtenerContexto(expedienteId);
  }

  @Post('expedientes/:expedienteId/procesos/lote')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  crearLote(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Body(new ZodValidationPipe(crearProcesosEnLoteSchema))
    datos: CrearProcesosEnLoteInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
    @Headers('idempotency-key') claveIdempotencia?: string,
  ) {
    return this.registroService.crearLote(
      expedienteId,
      datos,
      contexto,
      claveIdempotencia,
    );
  }
}
