import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  altaAtencionMedicaSchema,
  visibilidadAtencionMedicaSchema,
} from '@akyuam/shared';
import type {
  AltaAtencionMedicaDatos,
  VisibilidadAtencionMedicaInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { AltaAtencionService } from './alta-atencion.service';
import { VisibilidadService } from './visibilidad.service';

@Controller('medica/atenciones')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class AtencionesMedicasController {
  constructor(
    private readonly altaService: AltaAtencionService,
    private readonly visibilidadService: VisibilidadService,
  ) {}

  @Post(':id/alta')
  @HttpCode(200)
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  darAlta(
    @Param('id', ParseUUIDPipe) atencionId: string,
    @Body(new ZodValidationPipe(altaAtencionMedicaSchema))
    datos: AltaAtencionMedicaDatos,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.altaService.darAlta(atencionId, datos, contexto);
  }

  @Patch(':id/visibilidad')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  actualizarVisibilidad(
    @Param('id', ParseUUIDPipe) atencionId: string,
    @Body(new ZodValidationPipe(visibilidadAtencionMedicaSchema))
    datos: VisibilidadAtencionMedicaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.visibilidadService.actualizar(atencionId, datos, contexto);
  }
}
