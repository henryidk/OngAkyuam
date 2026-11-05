import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  CARPETA_ACTUACIONES,
  BITACORA_POR_PAGINA,
  type BitacoraPaginaDto,
  type BitacoraQuery,
  type DocumentoProcesoDto,
  type EntradaBitacoraDto,
  type RegistrarActuacionInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_ACTUACION } from '../compartido/mensajes';
import { DocumentosProcesoService } from '../documentos/documentos-proceso.service';
import { BITACORA_REPOSITORY } from '../interfaces/bitacora-repository.interface';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import { CARPETAS_REPOSITORY } from '../interfaces/documentos-proceso-repository.interface';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';

export interface SubirDocumentoActuacionParams {
  archivo: Express.Multer.File | undefined;
  nombreVisible?: string;
  tanda?: string;
}

@Injectable()
export class BitacoraService {
  constructor(
    @Inject(BITACORA_REPOSITORY)
    private readonly bitacoraRepository: IBitacoraRepository,
    @Inject(CARPETAS_REPOSITORY)
    private readonly carpetasRepository: ICarpetasRepository,
    private readonly documentosService: DocumentosProcesoService,
    private readonly acceso: AccesoJuridicoService,
    private readonly auditService: AuditService,
  ) {}

  async registrarActuacion(
    procesoId: string,
    datos: RegistrarActuacionInput,
    contexto: ContextoAuditoria,
  ): Promise<EntradaBitacoraDto> {
    await this.acceso.exigirProceso(procesoId);

    const entrada = await this.bitacoraRepository.registrar({
      procesoId,
      tipo: datos.tipo,
      // Lo que escribe la operadora nunca es una entrada de sistema, aunque el tipo diga "Sistema".
      esSistema: false,
      contenido: datos.contenido,
      registradoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'ACTUACION_PROCESO_REGISTRADA',
        entidad: 'NotaAvanceProceso',
        entidadId: entrada.id,
        detalles: { procesoId, tipo: datos.tipo },
      }),
    );

    return entrada;
  }

  /** Una página de la bitácora; la primera ya viaja con el detalle del proceso. */
  async listarPagina(
    procesoId: string,
    query: BitacoraQuery,
    contexto: ContextoAuditoria,
  ): Promise<BitacoraPaginaDto> {
    await this.acceso.exigirProceso(procesoId);

    // El filtro por proceso va dentro de la consulta: una página nunca trae entradas ajenas.
    const pagina = await this.bitacoraRepository.listarPagina(procesoId, {
      pagina: query.pagina,
      porPagina: BITACORA_POR_PAGINA,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'BITACORA_PROCESO_CONSULTADA',
        entidad: 'ProcesoJuridico',
        entidadId: procesoId,
        detalles: { pagina: query.pagina, entradas: pagina.entradas.length },
      }),
    );

    return pagina;
  }

  /**
   * El documento queda en la carpeta "Actuaciones" del proceso (se crea la primera vez) y
   * enlazado a la actuación. Las entradas de sistema no reciben documentos: no las escribió nadie.
   */
  async subirDocumento(
    procesoId: string,
    actuacionId: string,
    params: SubirDocumentoActuacionParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoProcesoDto> {
    await this.acceso.exigirProceso(procesoId);

    const entrada = await this.bitacoraRepository.buscarEnProceso(
      actuacionId,
      procesoId,
    );
    if (!entrada || entrada.esSistema) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_ACTUACION);
    }

    const carpetaId = await this.carpetasRepository.obtenerOCrear({
      procesoId,
      nombre: CARPETA_ACTUACIONES,
      creadaPorId: contexto.usuarioId,
    });
    return this.documentosService.subir(
      { ...params, procesoId, carpetaId, actuacionId },
      contexto,
    );
  }
}
