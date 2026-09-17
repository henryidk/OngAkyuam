import { Injectable } from '@nestjs/common';
import type { DocumentoProcesoDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearDocumentoProcesoParams,
  DocumentoParaDescarga,
  IDocumentosProcesoRepository,
} from '../interfaces/documentos-proceso-repository.interface';

function mapearDocumento(documento: {
  id: string;
  nombreVisible: string;
  nombreArchivo: string;
  tamanioBytes: number;
  createdAt: Date;
}): DocumentoProcesoDto {
  return {
    id: documento.id,
    nombreVisible: documento.nombreVisible,
    nombreArchivo: documento.nombreArchivo,
    tamanioBytes: documento.tamanioBytes,
    createdAt: documento.createdAt.toISOString(),
  };
}

@Injectable()
export class DocumentosProcesoRepository implements IDocumentosProcesoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(
    params: CrearDocumentoProcesoParams,
  ): Promise<DocumentoProcesoDto> {
    const documento = await this.prisma.documentoProceso.create({
      data: {
        procesoId: params.procesoId,
        nombreVisible: params.nombreVisible,
        nombreArchivo: params.nombreArchivo,
        claveR2: params.claveR2,
        mimeType: params.mimeType,
        tamanioBytes: params.tamanioBytes,
        subidoPorId: params.subidoPorId,
      },
    });
    return mapearDocumento(documento);
  }

  async listarPorProceso(procesoId: string): Promise<DocumentoProcesoDto[]> {
    const documentos = await this.prisma.documentoProceso.findMany({
      where: { procesoId },
      orderBy: { createdAt: 'desc' },
    });
    return documentos.map(mapearDocumento);
  }

  async buscarParaDescarga(
    documentoId: string,
    procesoId: string,
  ): Promise<DocumentoParaDescarga | null> {
    return this.prisma.documentoProceso.findFirst({
      where: { id: documentoId, procesoId },
      select: { claveR2: true, nombreVisible: true },
    });
  }
}
