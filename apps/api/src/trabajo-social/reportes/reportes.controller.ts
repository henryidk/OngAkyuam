import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  reportePoblacionQuerySchema,
  type ReportePoblacionQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportePoblacionService } from './reporte-poblacion.service';

// Las dos respuestas llevan nombres y DPI: `no-store` evita que el navegador o un proxy
// guarden una copia (plan §6).
@Controller('trabajo-social/reportes')
@UseGuards(RolesGuard)
@Roles('TRABAJO_SOCIAL')
export class ReportesController {
  constructor(private readonly reportePoblacion: ReportePoblacionService) {}

  @Get('poblacion-beneficiada')
  @Header('Cache-Control', 'no-store')
  async vistaPrevia(
    @Query(new ZodValidationPipe(reportePoblacionQuerySchema))
    query: ReportePoblacionQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.reportePoblacion.vistaPrevia(query, contexto);
  }

  @Get('poblacion-beneficiada.xlsx')
  @Header('Cache-Control', 'no-store')
  async exportar(
    @Query(new ZodValidationPipe(reportePoblacionQuerySchema))
    query: ReportePoblacionQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ): Promise<StreamableFile> {
    const archivo = await this.reportePoblacion.exportar(query, contexto);
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipoContenido,
      disposition: `attachment; filename="${archivo.nombreArchivo}"`,
      length: archivo.contenido.length,
    });
  }
}
