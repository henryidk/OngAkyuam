import { Injectable } from '@nestjs/common';
import type { DocumentoProcesoDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearDocumentoProcesoParams,
  DocumentoParaUrl,
  IDocumentosProcesoRepository,
  RenombrarDocumentoParams,
} from '../interfaces/documentos-proceso-repository.interface';
import { INCLUDE_SUBIDO_POR, mapearDocumento } from './mapeo-documento';

@Injectable()
export class DocumentosProcesoRepository implements IDocumentosProcesoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(
    params: CrearDocumentoProcesoParams,
  ): Promise<DocumentoProcesoDto> {
    const [documento] = await this.prisma.$transaction([
      this.prisma.documentoProceso.create({
        data: params,
        include: INCLUDE_SUBIDO_POR,
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
      include: INCLUDE_SUBIDO_POR,
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
}
