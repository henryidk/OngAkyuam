import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  finalizarProcesoSchema,
  registrarAbandonoSchema,
  suspenderProcesoSchema,
  transicionSimpleSchema,
  type FinalizarProcesoInput,
  type RegistrarAbandonoInput,
  type SuspenderProcesoInput,
  type TransicionSimpleInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { TransicionesProcesoService } from './transiciones-proceso.service';

// Un endpoint por transición (y no un PATCH que interprete el body): cada uno valida solo
// los datos que esa acción necesita.
@Controller('juridico/procesos/:procesoId')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class TransicionesController {
  constructor(private readonly transiciones: TransicionesProcesoService) {}

  @Post('finalizacion')
  @HttpCode(HttpStatus.NO_CONTENT)
  finalizar(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(finalizarProcesoSchema))
    datos: FinalizarProcesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.transiciones.finalizar(procesoId, datos, contexto);
  }

  @Post('suspension')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspender(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(suspenderProcesoSchema))
    datos: SuspenderProcesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.transiciones.suspender(procesoId, datos, contexto);
  }

  @Post('abandono')
  @HttpCode(HttpStatus.NO_CONTENT)
  abandonar(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(registrarAbandonoSchema))
    datos: RegistrarAbandonoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.transiciones.abandonar(procesoId, datos, contexto);
  }

  @Post('reactivacion')
  @HttpCode(HttpStatus.NO_CONTENT)
  reactivar(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(transicionSimpleSchema))
    datos: TransicionSimpleInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.transiciones.reactivar(procesoId, datos, contexto);
  }
}
