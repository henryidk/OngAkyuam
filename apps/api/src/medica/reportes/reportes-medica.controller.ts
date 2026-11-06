import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  informeAtencionMedicaQuerySchema,
  reportesMedicaQuerySchema,
} from '@akyuam/shared';
import type {
  InformeAtencionMedicaQuery,
  ReportesMedicaQuery,
} from '@akyuam/shared';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ContextoAuditoria } from '../../common/decorators/contexto-auditoria.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria as IContextoAuditoria } from '../../common/types/contexto-auditoria';
import { LimitePorUsuarioGuard } from '../../juridico/compartido/limite-por-usuario.guard';
import {
  IndicadoresMedicaService,
  type ArchivoReporteMedica,
} from './indicadores-medica.service';
import { InformeAtencionMedicaService } from './informe-atencion-medica.service';

function comoDescarga(archivo: ArchivoReporteMedica): StreamableFile {
  return new StreamableFile(archivo.contenido, {
    type: archivo.tipoContenido,
    disposition: `attachment; filename="${archivo.nombreArchivo}"`,
    length: archivo.contenido.length,
  });
}

@Controller('medica/reportes')
@UseGuards(RolesGuard)
@Roles('MEDICA')
export class ReportesMedicaController {
  constructor(
    private readonly indicadoresService: IndicadoresMedicaService,
    private readonly informeAtencion: InformeAtencionMedicaService,
  ) {}

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
    return comoDescarga(
      await this.indicadoresService.exportar(query, contexto),
    );
  }

  /** Informe de atención con el formato de la ONG, entre dos fechas de consulta. */
  @Get('atencion')
  @Header('Cache-Control', 'no-store')
  informe(
    @Query(new ZodValidationPipe(informeAtencionMedicaQuerySchema))
    query: InformeAtencionMedicaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ) {
    return this.informeAtencion.obtener(query, contexto);
  }

  @Get('atencion.xlsx')
  @UseGuards(LimitePorUsuarioGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async exportarInforme(
    @Query(new ZodValidationPipe(informeAtencionMedicaQuerySchema))
    query: InformeAtencionMedicaQuery,
    @ContextoAuditoria() contexto: IContextoAuditoria,
  ): Promise<StreamableFile> {
    return comoDescarga(await this.informeAtencion.exportar(query, contexto));
  }
}
