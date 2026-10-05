import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  registrarActuacionSchema,
  type RegistrarActuacionInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { BitacoraService } from './bitacora.service';

@Controller('juridico/procesos/:procesoId')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Post('bitacora')
  registrarActuacion(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body(new ZodValidationPipe(registrarActuacionSchema))
    datos: RegistrarActuacionInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bitacoraService.registrarActuacion(procesoId, datos, contexto);
  }

  @Get('tipos-actuacion')
  sugerirTipos(@Param('procesoId', ParseUUIDPipe) procesoId: string) {
    return this.bitacoraService.sugerirTipos(procesoId);
  }
}
