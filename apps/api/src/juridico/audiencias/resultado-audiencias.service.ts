import { Inject, Injectable } from '@nestjs/common';
import {
  CARPETA_AUDIENCIAS,
  ETIQUETAS_ESTADO_AUDIENCIA,
  type DocumentoProcesoDto,
  type ObservacionesAudienciaInput,
  type RegistrarResultadoAudienciaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { vacioANulo } from '../compartido/acceso-juridico';
import { MENSAJE_RESULTADO_ANTES_DE_TIEMPO } from '../compartido/mensajes';
import { DocumentosProcesoService } from '../documentos/documentos-proceso.service';
import { AUDIENCIAS_REPOSITORY } from '../interfaces/audiencias-repository.interface';
import type { IAudienciasRepository } from '../interfaces/audiencias-repository.interface';
import { CARPETAS_REPOSITORY } from '../interfaces/documentos-proceso-repository.interface';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';
import {
  auditarAudiencia,
  auditarNumeroJudicial,
} from './auditoria-audiencias';
import {
  exigirAccion,
  exigirAudiencia,
  exigirGuardado,
  momento,
} from './reglas-escritura';

export interface SubirDocumentoAudienciaParams {
  archivo: Express.Multer.File | undefined;
  nombreVisible?: string;
  tanda?: string;
}

/** Lo que pasa cuando llega la fecha: el resultado, lo ocurrido y los documentos de ese día. */
@Injectable()
export class ResultadoAudienciasService {
  constructor(
    @Inject(AUDIENCIAS_REPOSITORY)
    private readonly audienciasRepository: IAudienciasRepository,
    @Inject(CARPETAS_REPOSITORY)
    private readonly carpetasRepository: ICarpetasRepository,
    private readonly documentosService: DocumentosProcesoService,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly auditService: AuditService,
  ) {}

  async registrarResultado(
    audienciaId: string,
    datos: RegistrarResultadoAudienciaInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const ahora = this.reloj.ahora();
    const audiencia = await exigirAudiencia(
      this.audienciasRepository,
      audienciaId,
    );
    // Una PROGRAMADA a futuro tiene su propio mensaje: el botón no debería estar a la vista.
    const mensaje =
      audiencia.estado === 'PROGRAMADA' && audiencia.inicio > ahora
        ? MENSAJE_RESULTADO_ANTES_DE_TIEMPO
        : undefined;
    exigirAccion('REGISTRAR_RESULTADO', audiencia, ahora, mensaje);

    const guardado = exigirGuardado(
      await this.audienciasRepository.registrarResultado({
        procesoId: audiencia.procesoId,
        audienciaId,
        version: datos.version,
        usuarioId: contexto.usuarioId,
        resultado: datos.resultado,
        observaciones: vacioANulo(datos.observaciones),
        // El motivo solo explica un "No se realizó"; en una realizada no se guarda.
        motivo: datos.resultado === 'NO_REALIZADA' ? datos.motivo : null,
        numeroJudicial: datos.numeroJudicial,
        textoBitacora: `Audiencia del ${momento(audiencia.inicio)}: ${ETIQUETAS_ESTADO_AUDIENCIA[datos.resultado].toLowerCase()}`,
      }),
    );

    await auditarAudiencia(
      this.auditService,
      contexto,
      'AUDIENCIA_RESULTADO',
      audienciaId,
      { procesoId: audiencia.procesoId, resultado: datos.resultado },
    );
    await auditarNumeroJudicial(
      this.auditService,
      contexto,
      audiencia.procesoId,
      guardado.numeroJudicialAsignado,
    );
  }

  async editarObservaciones(
    audienciaId: string,
    datos: ObservacionesAudienciaInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const audiencia = await exigirAudiencia(
      this.audienciasRepository,
      audienciaId,
    );
    exigirAccion('EDITAR_OBSERVACIONES', audiencia, this.reloj.ahora());

    exigirGuardado(
      await this.audienciasRepository.editarObservaciones({
        procesoId: audiencia.procesoId,
        audienciaId,
        version: datos.version,
        usuarioId: contexto.usuarioId,
        observaciones: vacioANulo(datos.observaciones),
        textoBitacora: `Audiencia del ${momento(audiencia.inicio)}: se actualizaron las observaciones`,
      }),
    );

    await auditarAudiencia(
      this.auditService,
      contexto,
      'AUDIENCIA_OBSERVACIONES',
      audienciaId,
      { procesoId: audiencia.procesoId },
    );
  }

  /**
   * El documento queda en la carpeta "Audiencias" del proceso (se crea la primera vez) y
   * enlazado a la audiencia. La validación del archivo, la bitácora y la auditoría son las de
   * cualquier documento del proceso.
   */
  async subirDocumento(
    audienciaId: string,
    params: SubirDocumentoAudienciaParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoProcesoDto> {
    const audiencia = await exigirAudiencia(
      this.audienciasRepository,
      audienciaId,
    );
    exigirAccion('ADJUNTAR_DOCUMENTO', audiencia, this.reloj.ahora());

    const carpetaId = await this.carpetasRepository.obtenerOCrear({
      procesoId: audiencia.procesoId,
      nombre: CARPETA_AUDIENCIAS,
      creadaPorId: contexto.usuarioId,
    });
    return this.documentosService.subir(
      { ...params, procesoId: audiencia.procesoId, carpetaId, audienciaId },
      contexto,
    );
  }
}
