import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  reporteProcesosJuridicoQuerySchema,
  type ReporteProcesosJuridicoQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReporteProcesosService } from './reporte-procesos.service';

// Las dos respuestas llevan nombres de usuarias: `no-store` evita que el navegador o un proxy
// guarden una copia.
@Controller('juridico/reportes')
@UseGuards(RolesGuard)
@Roles('JURIDICO')
export class ReportesJuridicoController {
  constructor(private readonly reporteProcesos: ReporteProcesosService) {}

  @Get('procesos')
  @Header('Cache-Control', 'no-store')
  async vistaPrevia(
    @Query(new ZodValidationPipe(reporteProcesosJuridicoQuerySchema))
    query: ReporteProcesosJuridicoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.reporteProcesos.vistaPrevia(query, contexto);
  }

  @Get('procesos.xlsx')
  @Header('Cache-Control', 'no-store')
  async exportar(
    @Query(new ZodValidationPipe(reporteProcesosJuridicoQuerySchema))
    query: ReporteProcesosJuridicoQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ): Promise<StreamableFile> {
    const archivo = await this.reporteProcesos.exportar(query, contexto);
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipoContenido,
      disposition: `attachment; filename="${archivo.nombreArchivo}"`,
      length: archivo.contenido.length,
    });
  }
}
