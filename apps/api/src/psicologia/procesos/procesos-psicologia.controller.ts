import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  cerrarProcesoPsicologiaSchema,
  visibilidadProcesoPsicologiaSchema,
} from '@akyuam/shared';
import type {
  CerrarProcesoPsicologiaInput,
  VisibilidadProcesoPsicologiaInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { CierreProcesoService } from './cierre-proceso.service';
import { ProcesosPsicologiaService } from './procesos.service';

@Controller('psicologia/procesos')
@UseGuards(RolesGuard)
@Roles('PSICOLOGIA')
export class ProcesosPsicologiaController {
  constructor(
    private readonly cierreService: CierreProcesoService,
    private readonly procesosService: ProcesosPsicologiaService,
  ) {}

  @Post(':id/cierre')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cerrar(
    @Param('id', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(cerrarProcesoPsicologiaSchema))
    datos: CerrarProcesoPsicologiaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.cierreService.cerrar(procesoId, datos, contexto);
  }

  @Patch(':id/visibilidad')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  actualizarVisibilidad(
    @Param('id', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(visibilidadProcesoPsicologiaSchema))
    datos: VisibilidadProcesoPsicologiaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.procesosService.actualizarVisibilidad(
      procesoId,
      datos,
      contexto,
    );
  }
}
