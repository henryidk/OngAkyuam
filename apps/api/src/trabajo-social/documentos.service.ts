import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Rol } from '@prisma/client';
import {
  mimeTypePermitido,
  subirDocumentoSchema,
  TIPOS_DOCUMENTO_ALBERGUE,
  type DocumentoSubido,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import { OBJECT_STORAGE } from '../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import { DOCUMENTOS_REPOSITORY } from './interfaces/documentos-repository.interface';
import type {
  DocumentoCreado,
  IDocumentosRepository,
} from './interfaces/documentos-repository.interface';

interface SubirDocumentoParams {
  expedienteId: string;
  tipo: string | undefined;
  areasVisiblesRaw: string | undefined;
  archivo: Express.Multer.File;
}

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DocumentosService {
  constructor(
    @Inject(DOCUMENTOS_REPOSITORY)
    private readonly documentosRepository: IDocumentosRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async subir(
    params: SubirDocumentoParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoSubido> {
    if (!params.archivo) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }

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

    if (!mimeTypePermitido(params.archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    const expediente =
      await this.documentosRepository.buscarExpedienteParaSubida(
        params.expedienteId,
      );
    if (!expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }

    if (
      (TIPOS_DOCUMENTO_ALBERGUE as readonly string[]).includes(tipo) &&
      expediente.tipoRegistro !== 'INTERNA'
    ) {
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

    const claveR2 = `expedientes/${params.expedienteId}/${randomUUID()}`;
    await this.objectStorage.subirObjeto(
      claveR2,
      params.archivo.buffer,
      params.archivo.mimetype,
    );

    let documento: DocumentoCreado;
    try {
      documento = await this.documentosRepository.crear({
        expedienteId: params.expedienteId,
        tipo,
        nombreArchivo: params.archivo.originalname,
        claveR2,
        mimeType: params.archivo.mimetype,
        tamanioBytes: params.archivo.size,
        subidoPorId: contexto.usuarioId,
        areasVisibles: areasVisibles,
      });
    } catch (error) {
      // El objeto ya se subió a R2 pero la fila en base de datos falló: se limpia el
      // objeto huérfano en un mejor esfuerzo, sin ocultar el error original.
      await this.objectStorage.eliminarObjeto(claveR2).catch(() => undefined);
      throw error;
    }

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
