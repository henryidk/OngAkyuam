import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearDocumentoParams,
  DocumentoCreado,
  ExpedienteParaDocumento,
  IDocumentosRepository,
} from '../interfaces/documentos-repository.interface';

@Injectable()
export class DocumentosRepository implements IDocumentosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpedienteParaSubida(
    expedienteId: string,
  ): Promise<ExpedienteParaDocumento | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: {
        tipoRegistro: true,
        referidos: { select: { area: true } },
      },
    });
    if (!expediente) {
      return null;
    }
    return {
      tipoRegistro: expediente.tipoRegistro,
      areasReferidas: expediente.referidos.map((referido) => referido.area),
    };
  }

  async crear(params: CrearDocumentoParams): Promise<DocumentoCreado> {
    const documento = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.documento.create({
        data: {
          expedienteId: params.expedienteId,
          tipo: params.tipo,
          nombreArchivo: params.nombreArchivo,
          claveR2: params.claveR2,
          mimeType: params.mimeType,
          tamanioBytes: params.tamanioBytes,
          subidoPorId: params.subidoPorId,
        },
      });

      if (params.areasVisibles.length > 0) {
        await tx.documentoVisibilidadArea.createMany({
          data: params.areasVisibles.map((area) => ({
            documentoId: creado.id,
            area,
            otorgadoPorId: params.subidoPorId,
          })),
        });
      }

      return creado;
    });

    return {
      id: documento.id,
      tipo: documento.tipo,
      nombreArchivo: documento.nombreArchivo,
      tamanioBytes: documento.tamanioBytes,
      createdAt: documento.createdAt,
    };
  }
}
