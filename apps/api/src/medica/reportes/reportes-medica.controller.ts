import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { reportesMedicaQuerySchema } from '@akyuam/shared';
import type { ReportesMedicaQuery } from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import { IndicadoresMedicaService } from './indicadores-medica.service';

@Controller('medica/reportes')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class ReportesMedicaController {
  constructor(private readonly indicadoresService: IndicadoresMedicaService) {}

  @Get()
  obtener(
    @Query(new ZodValidationPipe(reportesMedicaQuerySchema))
    query: ReportesMedicaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.indicadoresService.obtener(query, contexto);
  }

  /** Excel de agregados. Pocas descargas por minuto: genera el archivo completo. */
  @Get('excel')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportar(
    @Query(new ZodValidationPipe(reportesMedicaQuerySchema))
    query: ReportesMedicaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ): Promise<StreamableFile> {
    const archivo = await this.indicadoresService.exportar(query, contexto);
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipoContenido,
      disposition: `attachment; filename="${archivo.nombreArchivo}"`,
      length: archivo.contenido.length,
    });
  }
}
