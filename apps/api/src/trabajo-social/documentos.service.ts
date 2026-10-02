import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Rol } from '@prisma/client';
import {
  documentosRequeridos,
  mimeTypePermitido,
  subirDocumentoSchema,
  TIPOS_DOCUMENTO_TRABAJO_SOCIAL,
  tipoDocumentoAplicaARegistro,
  type AreaAtencion,
  type DocumentoSubido,
  type DocumentosCaso,
  type EstadoDocumentoCaso,
  type FilaDocumentoCaso,
  type TipoDocumentoTrabajoSocial,
  type VersionDocumento,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import type { ContextoAuditoria } from '../common/types/contexto-auditoria';
import { OBJECT_STORAGE } from '../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import {
  DOCUMENTOS_REPOSITORY,
  DocumentoYaReemplazadoError,
} from './interfaces/documentos-repository.interface';
import type {
  ArchivoDocumento,
  DocumentoCreado,
  DocumentoVigente,
  ExpedienteParaDocumento,
  IDocumentosRepository,
} from './interfaces/documentos-repository.interface';

interface SubirDocumentoParams {
  expedienteId: string;
  tipo: string | undefined;
  areasVisiblesRaw: string | undefined;
  archivo: Express.Multer.File;
}

interface SubirVersionParams {
  expedienteId: string;
  documentoId: string;
  archivo: Express.Multer.File;
}

function estadoDocumento(
  tipo: TipoDocumentoTrabajoSocial,
  expediente: ExpedienteParaDocumento,
  vigente: DocumentoVigente | undefined,
): EstadoDocumentoCaso {
  if (vigente) {
    return 'SUBIDO';
  }
  if (tipo === 'CONVENIO_EGRESO' && !expediente.tieneEgresoAlbergue) {
    return 'AUN_NO_APLICA';
  }
  return 'FALTANTE';
}

function aVersionSinAreas(vigente: DocumentoVigente): VersionDocumento {
  return {
    id: vigente.id,
    version: vigente.version,
    vigente: vigente.vigente,
    nombreArchivo: vigente.nombreArchivo,
    mimeType: vigente.mimeType,
    tamanioBytes: vigente.tamanioBytes,
    createdAt: vigente.createdAt,
    subidoPor: vigente.subidoPor,
  };
}

/** Una fila por formulario de Trabajo Social que aplica al tipo de registro del caso. */
export function construirFilasDocumentos(
  expediente: ExpedienteParaDocumento,
  vigentes: DocumentoVigente[],
): FilaDocumentoCaso[] {
  const requeridos = documentosRequeridos(
    expediente.tipoRegistro,
    expediente.tieneEgresoAlbergue,
  );
  return TIPOS_DOCUMENTO_TRABAJO_SOCIAL.filter((tipo) =>
    tipoDocumentoAplicaARegistro(tipo, expediente.tipoRegistro),
  ).map((tipo) => {
    const vigente = vigentes.find((documento) => documento.tipo === tipo);
    return {
      tipo,
      estado: estadoDocumento(tipo, expediente, vigente),
      requerido: requeridos.includes(tipo),
      vigente: vigente ? aVersionSinAreas(vigente) : null,
      // Visibilidad solo se otorga a áreas de atención (validado al subir y al referir).
      areasVisibles: (vigente?.areasVisibles ?? []) as AreaAtencion[],
    };
  });
}

const MENSAJE_ALMACENAMIENTO_NO_DISPONIBLE =
  'No se pudo guardar el archivo en el almacenamiento. Inténtalo de nuevo en unos minutos.';

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(
    @Inject(DOCUMENTOS_REPOSITORY)
    private readonly documentosRepository: IDocumentosRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async listar(expedienteId: string): Promise<DocumentosCaso> {
    const expediente = await this.buscarExpedienteOFallar(expedienteId);
    const vigentes =
      await this.documentosRepository.listarVigentes(expedienteId);
    return {
      expedienteId,
      numero: expediente.numero,
      filas: construirFilasDocumentos(expediente, vigentes),
    };
  }

  async subir(
    params: SubirDocumentoParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoSubido> {
    this.validarArchivo(params.archivo);

    const datosValidados = subirDocumentoSchema.safeParse({
      tipo: params.tipo,
      areasVisibles: this.parsearAreasVisibles(params.areasVisiblesRaw),
    });
    if (!datosValidados.success) {
      throw new BadRequestException(
        datosValidados.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      );
    }
    const { tipo, areasVisibles } = datosValidados.data;

    const expediente = await this.buscarExpedienteOFallar(params.expedienteId);

    if (!tipoDocumentoAplicaARegistro(tipo, expediente.tipoRegistro)) {
      throw new BadRequestException(
        'Este documento solo aplica a registros internos (solicitud de albergue)',
      );
    }

    const areaNoReferida = areasVisibles.find(
      (area) => !expediente.areasReferidas.includes(area as Rol),
    );
    if (areaNoReferida) {
      throw new BadRequestException(
        `El área ${areaNoReferida} no fue referida a este expediente`,
      );
    }

    if (
      await this.documentosRepository.existeVigente(params.expedienteId, tipo)
    ) {
      throw new ConflictException(
        'Este caso ya tiene este documento. Usa "Actualizar" para subir una nueva versión.',
      );
    }

    const documento = await this.subirYRegistrar(
      params.expedienteId,
      params.archivo,
      contexto,
      (archivo) =>
        this.documentosRepository.crear({
          ...archivo,
          expedienteId: params.expedienteId,
          tipo,
          areasVisibles,
        }),
    );

    // Nunca nombreArchivo ni ningún dato personal en `detalles` (mismo criterio que
    // EXPEDIENTE_CREADO: solo IDs/tipos, nada identificable).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_SUBIDO',
      entidad: 'Documento',
      entidadId: documento.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId: params.expedienteId, tipo },
    });

    return this.aDocumentoSubido(documento);
  }

  async subirVersion(
    params: SubirVersionParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoSubido> {
    this.validarArchivo(params.archivo);

    const anterior = await this.documentosRepository.buscarParaVersionar(
      params.documentoId,
      params.expedienteId,
    );
    if (!anterior) {
      throw new NotFoundException('Documento no encontrado');
    }
    if (
      !(TIPOS_DOCUMENTO_TRABAJO_SOCIAL as readonly string[]).includes(
        anterior.tipo,
      )
    ) {
      throw new BadRequestException('Este documento no admite versiones');
    }
    if (!anterior.vigente) {
      throw new ConflictException(new DocumentoYaReemplazadoError().message);
    }

    let documento: DocumentoCreado;
    try {
      documento = await this.subirYRegistrar(
        params.expedienteId,
        params.archivo,
        contexto,
        (archivo) =>
          this.documentosRepository.crearVersion({ ...archivo, anterior }),
      );
    } catch (error) {
      if (error instanceof DocumentoYaReemplazadoError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_VERSION_SUBIDA',
      entidad: 'Documento',
      entidadId: documento.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: {
        expedienteId: params.expedienteId,
        tipo: documento.tipo,
        version: documento.version,
        reemplazaAId: anterior.id,
      },
    });

    return this.aDocumentoSubido(documento);
  }

  async listarVersiones(
    expedienteId: string,
    documentoId: string,
  ): Promise<VersionDocumento[]> {
    const versiones = await this.documentosRepository.listarVersiones(
      documentoId,
      expedienteId,
    );
    if (!versiones) {
      throw new NotFoundException('Documento no encontrado');
    }
    return versiones;
  }

  async obtenerUrl(
    expedienteId: string,
    documentoId: string,
    inline: boolean,
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    const documento = await this.documentosRepository.buscarParaDescarga(
      documentoId,
      expedienteId,
    );
    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    // Filas antiguas podrían tener un MIME fuera de la lista blanca actual: esas nunca se
    // muestran inline, solo se descargan.
    const vistaPrevia = inline && mimeTypePermitido(documento.mimeType);
    const url = vistaPrevia
      ? await this.objectStorage.generarUrlVistaPrevia(
          documento.claveR2,
          documento.mimeType,
        )
      : await this.objectStorage.generarUrlDescarga(
          documento.claveR2,
          documento.nombreArchivo,
        );

    // Mismo criterio que AreasService.obtenerUrlDescarga: leer un archivo sensible se audita
    // igual que subirlo.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: vistaPrevia ? 'DOCUMENTO_VISUALIZADO' : 'DOCUMENTO_DESCARGADO',
      entidad: 'Documento',
      entidadId: documentoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId },
    });

    return { url };
  }

  private async buscarExpedienteOFallar(
    expedienteId: string,
  ): Promise<ExpedienteParaDocumento> {
    const expediente =
      await this.documentosRepository.buscarExpediente(expedienteId);
    if (!expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }
    return expediente;
  }

  private validarArchivo(archivo: Express.Multer.File | undefined): void {
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    if (!mimeTypePermitido(archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }
  }

  /** Sube el binario a R2 con una clave nueva y registra la fila; si la BD falla, limpia R2. */
  private async subirYRegistrar(
    expedienteId: string,
    archivo: Express.Multer.File,
    contexto: ContextoAuditoria,
    registrar: (archivo: ArchivoDocumento) => Promise<DocumentoCreado>,
  ): Promise<DocumentoCreado> {
    const claveR2 = `expedientes/${expedienteId}/${randomUUID()}`;
    try {
      await this.objectStorage.subirObjeto(
        claveR2,
        archivo.buffer,
        archivo.mimetype,
      );
    } catch (error) {
      // R2 inalcanzable (red, DNS, credenciales): es un 503 reintentable, no un fallo del
      // sistema. Solo se registra el mensaje técnico, nunca el nombre del archivo.
      this.logger.error(
        `No se pudo subir el objeto a R2: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      throw new ServiceUnavailableException(
        MENSAJE_ALMACENAMIENTO_NO_DISPONIBLE,
      );
    }

    try {
      return await registrar({
        nombreArchivo: archivo.originalname,
        claveR2,
        mimeType: archivo.mimetype,
        tamanioBytes: archivo.size,
        subidoPorId: contexto.usuarioId,
      });
    } catch (error) {
      // El objeto ya se subió a R2 pero la fila en base de datos falló: se limpia el
      // objeto huérfano en un mejor esfuerzo, sin ocultar el error original.
      await this.objectStorage.eliminarObjeto(claveR2).catch(() => undefined);
      throw error;
    }
  }

  private aDocumentoSubido(documento: DocumentoCreado): DocumentoSubido {
    return {
      id: documento.id,
      tipo: documento.tipo,
      nombreArchivo: documento.nombreArchivo,
      tamanioBytes: documento.tamanioBytes,
      createdAt: documento.createdAt.toISOString(),
    };
  }

  private parsearAreasVisibles(raw: string | undefined): unknown {
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new BadRequestException('areasVisibles inválido');
    }
  }
}
