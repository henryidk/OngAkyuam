import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  mimeTypePermitido,
  normalizarNombreCarpeta,
  type CarpetaDto,
  type DocumentoProcesoDto,
  type UrlDocumentoProcesoQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { RedisService } from '../../redis/redis.service';
import { OBJECT_STORAGE } from '../../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CARPETA_DUPLICADA,
  MENSAJE_SIN_ACCESO_CARPETA,
  MENSAJE_SIN_ACCESO_DOCUMENTO,
} from '../compartido/mensajes';
import { BITACORA_REPOSITORY } from '../interfaces/bitacora-repository.interface';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import {
  CARPETAS_REPOSITORY,
  DOCUMENTOS_PROCESO_REPOSITORY,
} from '../interfaces/documentos-proceso-repository.interface';
import type {
  ICarpetasRepository,
  IDocumentosProcesoRepository,
} from '../interfaces/documentos-proceso-repository.interface';
import {
  resolverNombreVisible,
  validarArchivo,
  type MotivoArchivoInvalido,
} from './validador-archivo';

const MENSAJES_ARCHIVO: Record<MotivoArchivoInvalido, string> = {
  VACIO: 'El archivo está vacío',
  TIPO_NO_PERMITIDO: 'Tipo de archivo no permitido. Solo PDF o imágenes',
  CONTENIDO_NO_COINCIDE: 'El contenido del archivo no corresponde a su tipo',
};

/** Ventana en la que archivos de una misma tanda comparten una sola entrada de bitácora. */
const TTL_TANDA_SEGUNDOS = 120;
const FORMATO_TANDA = /^[A-Za-z0-9-]{8,64}$/;

interface EstadoTanda {
  entradaId: string;
  cantidad: number;
}

export interface SubirDocumentoParams {
  procesoId: string;
  carpetaId: string;
  archivo: Express.Multer.File | undefined;
  nombreVisible?: string;
  /** Identificador de la tanda de subida (header `X-Lote-Subida`). */
  tanda?: string;
}

function textoTanda(cantidad: number): string {
  return cantidad === 1
    ? 'Se subió 1 documento'
    : `Se subieron ${cantidad} documentos`;
}

@Injectable()
export class DocumentosProcesoService {
  private readonly logger = new Logger(DocumentosProcesoService.name);
  /** Turnos por tanda: los archivos suben de a dos y ambos tocarían el mismo contador. */
  private readonly turnos = new Map<string, Promise<void>>();

  constructor(
    @Inject(CARPETAS_REPOSITORY)
    private readonly carpetasRepository: ICarpetasRepository,
    @Inject(DOCUMENTOS_PROCESO_REPOSITORY)
    private readonly documentosRepository: IDocumentosProcesoRepository,
    @Inject(BITACORA_REPOSITORY)
    private readonly bitacoraRepository: IBitacoraRepository,
    @Inject(OBJECT_STORAGE)
    private readonly storage: IObjectStorage,
    private readonly acceso: AccesoJuridicoService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async crearCarpeta(
    procesoId: string,
    nombre: string,
    contexto: ContextoAuditoria,
  ): Promise<CarpetaDto> {
    await this.acceso.exigirProceso(procesoId);

    const carpeta = await this.carpetasRepository.crear({
      procesoId,
      nombre: normalizarNombreCarpeta(nombre),
      creadaPorId: contexto.usuarioId,
    });
    if (!carpeta) {
      throw new ConflictException(MENSAJE_CARPETA_DUPLICADA);
    }

    await this.auditar(contexto, 'CARPETA_PROCESO_CREADA', carpeta.id, {
      procesoId,
    });
    return carpeta;
  }

  async renombrarCarpeta(
    procesoId: string,
    carpetaId: string,
    nombre: string,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    await this.acceso.exigirProceso(procesoId);

    const resultado = await this.carpetasRepository.renombrar({
      carpetaId,
      procesoId,
      nombre: normalizarNombreCarpeta(nombre),
    });
    if (resultado === 'INEXISTENTE') {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CARPETA);
    }
    if (resultado === 'NOMBRE_DUPLICADO') {
      throw new ConflictException(MENSAJE_CARPETA_DUPLICADA);
    }

    await this.auditar(contexto, 'CARPETA_PROCESO_RENOMBRADA', carpetaId, {
      procesoId,
    });
  }

  async subir(
    params: SubirDocumentoParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoProcesoDto> {
    const { procesoId, carpetaId, archivo } = params;
    const proceso = await this.acceso.exigirProceso(procesoId);
    if (
      !(await this.carpetasRepository.perteneceAlProceso(carpetaId, procesoId))
    ) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CARPETA);
    }

    if (!archivo) {
      throw new BadRequestException('Archivo requerido');
    }
    const motivo = validarArchivo({
      mimeType: archivo.mimetype,
      contenido: archivo.buffer,
    });
    if (motivo) {
      throw new BadRequestException(MENSAJES_ARCHIVO[motivo]);
    }
    if (params.tanda !== undefined && !FORMATO_TANDA.test(params.tanda)) {
      throw new BadRequestException('X-Lote-Subida inválido');
    }

    // La clave no lleva nada escrito por la persona (ni nombre ni extensión): solo ids.
    const claveR2 = `procesos-juridicos/${proceso.expedienteId}/${procesoId}/${randomUUID()}`;
    await this.storage.subirObjeto(claveR2, archivo.buffer, archivo.mimetype);

    let documento: DocumentoProcesoDto;
    try {
      documento = await this.documentosRepository.crear({
        procesoId,
        carpetaId,
        nombreVisible: resolverNombreVisible(
          params.nombreVisible,
          archivo.originalname,
        ),
        nombreArchivo: archivo.originalname,
        claveR2,
        mimeType: archivo.mimetype,
        tamanioBytes: archivo.size,
        subidoPorId: contexto.usuarioId,
      });
    } catch (error) {
      // Sin fila en la base nadie podría volver a encontrar ese archivo: se quita del
      // almacenamiento para que no quede huérfano.
      await this.storage.eliminarObjeto(claveR2).catch(() => {
        this.logger.error(
          'No se pudo eliminar un archivo huérfano tras fallar el registro',
        );
      });
      throw error;
    }

    await this.anotarEnBitacora(procesoId, contexto.usuarioId, params.tanda);
    await this.auditar(contexto, 'DOCUMENTO_PROCESO_SUBIDO', documento.id, {
      procesoId,
      carpetaId,
    });
    return documento;
  }

  async renombrarDocumento(
    procesoId: string,
    documentoId: string,
    nombreVisible: string,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoProcesoDto> {
    await this.acceso.exigirProceso(procesoId);

    const documento = await this.documentosRepository.renombrar({
      documentoId,
      procesoId,
      nombreVisible: resolverNombreVisible(nombreVisible, ''),
    });
    if (!documento) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }

    await this.auditar(contexto, 'DOCUMENTO_PROCESO_RENOMBRADO', documentoId, {
      procesoId,
      carpetaId: documento.carpetaId,
    });
    return documento;
  }

  async generarUrl(
    procesoId: string,
    documentoId: string,
    modo: UrlDocumentoProcesoQuery['modo'],
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    await this.acceso.exigirProceso(procesoId);

    const documento = await this.documentosRepository.buscarParaUrl(
      documentoId,
      procesoId,
    );
    if (!documento) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }

    // La vista dentro de la app solo existe para tipos que el navegador muestra sin ejecutar
    // nada; cualquier otro se entrega siempre como descarga.
    const comoVista = modo === 'vista' && mimeTypePermitido(documento.mimeType);
    const url = comoVista
      ? await this.storage.generarUrlVistaPrevia(
          documento.claveR2,
          documento.mimeType,
        )
      : await this.storage.generarUrlDescarga(
          documento.claveR2,
          documento.nombreVisible,
        );

    await this.auditar(
      contexto,
      comoVista ? 'DOCUMENTO_PROCESO_VISTO' : 'DOCUMENTO_PROCESO_DESCARGADO',
      documentoId,
      { procesoId, carpetaId: documento.carpetaId },
    );
    return { url };
  }

  private auditar(
    contexto: ContextoAuditoria,
    accion: string,
    entidadId: string,
    detalles: Record<string, string>,
  ): Promise<void> {
    const entidad = accion.startsWith('CARPETA')
      ? 'CarpetaProceso'
      : 'DocumentoProceso';
    return this.auditService.registrar(
      eventoAuditoria(contexto, { accion, entidad, entidadId, detalles }),
    );
  }

  /**
   * Una tanda de varios archivos deja una sola línea en la bitácora ("Se subieron 3
   * documentos") en vez de una por archivo. Sin tanda, cada archivo deja la suya.
   */
  private async anotarEnBitacora(
    procesoId: string,
    usuarioId: string,
    tanda: string | undefined,
  ): Promise<void> {
    if (!tanda) {
      await this.nuevaEntrada(procesoId, usuarioId);
      return;
    }
    const clave = `juridico:subida:${procesoId}:${usuarioId}:${tanda}`;
    await this.enTurno(clave, async () => {
      const guardado = await this.redisService.get(clave);
      const previo = guardado ? (JSON.parse(guardado) as EstadoTanda) : null;

      let estado: EstadoTanda;
      if (previo) {
        estado = { ...previo, cantidad: previo.cantidad + 1 };
        await this.bitacoraRepository.actualizarContenido(
          estado.entradaId,
          textoTanda(estado.cantidad),
        );
      } else {
        estado = {
          entradaId: await this.nuevaEntrada(procesoId, usuarioId),
          cantidad: 1,
        };
      }
      await this.redisService.set(
        clave,
        JSON.stringify(estado),
        TTL_TANDA_SEGUNDOS,
      );
    });
  }

  private async nuevaEntrada(
    procesoId: string,
    usuarioId: string,
  ): Promise<string> {
    const entrada = await this.bitacoraRepository.registrar({
      procesoId,
      tipo: 'SISTEMA',
      contenido: textoTanda(1),
      registradoPorId: usuarioId,
    });
    return entrada.id;
  }

  /** Ejecuta `tarea` cuando terminen las anteriores de la misma clave. */
  private async enTurno(
    clave: string,
    tarea: () => Promise<void>,
  ): Promise<void> {
    const anterior = this.turnos.get(clave) ?? Promise.resolve();
    const actual = anterior.catch(() => undefined).then(tarea);
    this.turnos.set(clave, actual);
    try {
      await actual;
    } finally {
      if (this.turnos.get(clave) === actual) {
        this.turnos.delete(clave);
      }
    }
  }
}
