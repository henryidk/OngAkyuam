import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  urlDocumentoMedicoQuerySchema,
  type UrlDocumentoMedicoQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { VistaMedicaJuridicoService } from './vista-medica-juridico.service';

@Controller('juridico/usuarias/:usuariaId/medicina')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class VistaMedicaJuridicoController {
  constructor(private readonly vistaMedica: VistaMedicaJuridicoService) {}

  @Get()
  listar(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.vistaMedica.listar(usuariaId, contexto);
  }

  @Get('documentos/:documentoId/url')
  url(
    @Param('usuariaId', ParseUUIDPipe) usuariaId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @Query(new ZodValidationPipe(urlDocumentoMedicoQuerySchema))
    query: UrlDocumentoMedicoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.vistaMedica.url(usuariaId, documentoId, query, contexto);
  }
}
