import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  actualizarAccesoSchema,
  AREAS_ATENCION,
  type ActualizarAccesoInput,
  type AreaAtencion,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccesosService } from './accesos.service';

// `ZodValidationPipe` solo valida body/query: el área de la ruta se valida contra el mismo
// catálogo con `ParseEnumPipe`.
const AREA_ATENCION_ENUM = Object.fromEntries(
  AREAS_ATENCION.map((area) => [area, area]),
);

@Controller('trabajo-social/expedientes/:expedienteId/accesos')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class AccesosController {
  constructor(private readonly accesosService: AccesosService) {}

  @Get()
  async obtener(@Param('expedienteId', ParseUUIDPipe) expedienteId: string) {
    return this.accesosService.obtenerMatriz(expedienteId);
  }

  @Put(':area')
  async actualizar(
    @Param('expedienteId', ParseUUIDPipe) expedienteId: string,
    @Param('area', new ParseEnumPipe(AREA_ATENCION_ENUM)) area: AreaAtencion,
    @Body(new ZodValidationPipe(actualizarAccesoSchema))
    cambios: ActualizarAccesoInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.accesosService.actualizar(
      expedienteId,
      area,
      cambios,
      contexto,
    );
  }
}
