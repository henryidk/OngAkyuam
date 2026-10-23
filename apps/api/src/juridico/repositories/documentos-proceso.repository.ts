import { Injectable } from '@nestjs/common';
import type { DocumentoProcesoDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearDocumentoProcesoParams,
  DocumentoParaReemplazo,
  DocumentoParaUrl,
  IDocumentosProcesoRepository,
  ReemplazarArchivoParams,
  RenombrarDocumentoParams,
} from '../interfaces/documentos-proceso-repository.interface';
import { INCLUDE_DOCUMENTO, mapearDocumento } from './mapeo-documento';

@Injectable()
export class DocumentosProcesoRepository implements IDocumentosProcesoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(
    params: CrearDocumentoProcesoParams,
  ): Promise<DocumentoProcesoDto> {
    const [documento] = await this.prisma.$transaction([
      this.prisma.documentoProceso.create({
        data: params,
        include: INCLUDE_DOCUMENTO,
      }),
      this.prisma.procesoJuridico.update({
        where: { id: params.procesoId },
        data: { ultimaActuacionEn: new Date() },
        select: { id: true },
      }),
    ]);
    return mapearDocumento(documento);
  }

  async renombrar(
    params: RenombrarDocumentoParams,
  ): Promise<DocumentoProcesoDto | null> {
    const { count } = await this.prisma.documentoProceso.updateMany({
      where: { id: params.documentoId, procesoId: params.procesoId },
      data: { nombreVisible: params.nombreVisible },
    });
    if (count !== 1) {
      return null;
    }
    const documento = await this.prisma.documentoProceso.findFirst({
      where: { id: params.documentoId, procesoId: params.procesoId },
      include: INCLUDE_DOCUMENTO,
    });
    return documento ? mapearDocumento(documento) : null;
  }

  async buscarParaUrl(
    documentoId: string,
    procesoId: string,
  ): Promise<DocumentoParaUrl | null> {
    return this.prisma.documentoProceso.findFirst({
      where: { id: documentoId, procesoId },
      select: {
        claveR2: true,
        nombreVisible: true,
        mimeType: true,
        carpetaId: true,
      },
    });
  }

  async buscarParaReemplazo(
    documentoId: string,
    procesoId: string,
  ): Promise<DocumentoParaReemplazo | null> {
    return this.prisma.documentoProceso.findFirst({
      where: { id: documentoId, procesoId },
      select: {
        claveR2: true,
        carpetaId: true,
        audienciaId: true,
        actuacionId: true,
      },
    });
  }

  async reemplazarArchivo(
    params: ReemplazarArchivoParams,
  ): Promise<DocumentoProcesoDto | null> {
    const { documentoId, procesoId, claveAnterior, ...archivo } = params;
    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      // La condición sobre la clave anterior hace de candado: si dos personas reemplazan a
      // la vez, solo una actualiza la fila y la otra recibe `null`.
      const { count } = await tx.documentoProceso.updateMany({
        where: { id: documentoId, procesoId, claveR2: claveAnterior },
        data: { ...archivo, createdAt: ahora },
      });
      if (count !== 1) {
        return null;
      }
      await tx.procesoJuridico.update({
        where: { id: procesoId },
        data: { ultimaActuacionEn: ahora },
        select: { id: true },
      });
      const documento = await tx.documentoProceso.findFirstOrThrow({
        where: { id: documentoId, procesoId },
        include: INCLUDE_DOCUMENTO,
      });
      return mapearDocumento(documento);
    });
  }
}
