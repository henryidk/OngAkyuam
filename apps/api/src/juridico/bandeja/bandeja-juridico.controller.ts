import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  bandejaJuridicoQuerySchema,
  devolverReferenciaSchema,
  type BandejaJuridicoQuery,
  type DevolverReferenciaInput,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { BandejaJuridicoService } from './bandeja-juridico.service';

@Controller('juridico/bandeja')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class BandejaJuridicoController {
  constructor(private readonly bandejaService: BandejaJuridicoService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(bandejaJuridicoQuerySchema))
    query: BandejaJuridicoQuery,
  ) {
    return this.bandejaService.listar(query.vista);
  }

  @Post(':referidoId/devolucion')
  @HttpCode(HttpStatus.NO_CONTENT)
  devolver(
    @Param('referidoId', ParseUUIDPipe) referidoId: string,
    @Body(new ZodValidationPipe(devolverReferenciaSchema))
    datos: DevolverReferenciaInput,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.bandejaService.devolver(referidoId, datos, contexto);
  }
}
