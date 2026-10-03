import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  mimeTypePermitido,
  subirDocumentoPendienteSchema,
  type DocumentoPendienteSubido,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { OBJECT_STORAGE } from '../../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import { DOCUMENTOS_PENDIENTES_REPOSITORY } from './interfaces/documentos-pendientes-repository.interface';
import type {
  DocumentoPendienteCreado,
  IDocumentosPendientesRepository,
} from './interfaces/documentos-pendientes-repository.interface';

interface SubirDocumentoPendienteParams {
  tipo: string | undefined;
  archivo: Express.Multer.File | undefined;
}

/**
 * Escaneos del paso "Documentos" del registro: se suben a R2 en cuanto se eligen, para que el
 * progreso y los errores se vean en ese paso y no después de registrar. Se adjuntan al
 * expediente en la transacción que lo crea (ver `ExpedientesRepository`).
 */
@Injectable()
export class DocumentosPendientesService {
  private readonly logger = new Logger(DocumentosPendientesService.name);

  constructor(
    @Inject(DOCUMENTOS_PENDIENTES_REPOSITORY)
    private readonly repository: IDocumentosPendientesRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async subir(
    params: SubirDocumentoPendienteParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoPendienteSubido> {
    const { archivo } = params;
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    if (!mimeTypePermitido(archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }
    const datos = subirDocumentoPendienteSchema.safeParse({
      tipo: params.tipo,
    });
    if (!datos.success) {
      throw new BadRequestException('Tipo de documento inválido');
    }

    // La clave no cambia al adjuntarlo al expediente: R2 no tiene "mover" y copiar no aporta nada.
    const claveR2 = `registro/${randomUUID()}`;
    // Si R2 no responde, el almacenamiento ya lanza un 503 (ver R2StorageService).
    await this.objectStorage.subirObjeto(
      claveR2,
      archivo.buffer,
      archivo.mimetype,
    );

    let creado: DocumentoPendienteCreado;
    try {
      creado = await this.repository.crear({
        tipo: datos.data.tipo,
        nombreArchivo: archivo.originalname,
        claveR2,
        mimeType: archivo.mimetype,
        tamanioBytes: archivo.size,
        subidoPorId: contexto.usuarioId,
      });
    } catch (error) {
      // Mismo criterio que DocumentosService: sin fila, el objeto queda huérfano — se limpia
      // en un mejor esfuerzo sin ocultar el error original.
      await this.objectStorage.eliminarObjeto(claveR2).catch(() => undefined);
      throw error;
    }

    // Nunca el nombre del archivo en `detalles`: solo IDs y tipos.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_PENDIENTE_SUBIDO',
      entidad: 'DocumentoPendiente',
      entidadId: creado.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { tipo: creado.tipo },
    });

    return {
      id: creado.id,
      tipo: datos.data.tipo,
      nombreArchivo: creado.nombreArchivo,
      tamanioBytes: creado.tamanioBytes,
    };
  }

  /** "Quitar" o "Cambiar" en el paso Documentos: borra fila y objeto en el momento. */
  async descartar(id: string, contexto: ContextoAuditoria): Promise<void> {
    const claveR2 = await this.repository.eliminarDeUsuario(
      id,
      contexto.usuarioId,
    );
    if (!claveR2) {
      throw new NotFoundException('Documento no encontrado');
    }

    try {
      await this.objectStorage.eliminarObjeto(claveR2);
    } catch (error) {
      // La fila ya no existe, así que nadie puede adjuntarlo; solo queda el objeto en R2.
      // Nunca la clave en el log.
      this.logger.error(
        `No se pudo borrar de R2 un documento pendiente descartado: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_PENDIENTE_DESCARTADO',
      entidad: 'DocumentoPendiente',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });
  }
}
