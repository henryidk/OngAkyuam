import { Injectable } from '@nestjs/common';
import type { DocumentoCitaDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearDocumentoCitaParams,
  DocumentoCitaParaDescarga,
  IDocumentosCitaRepository,
} from '../interfaces/documentos-cita-repository.interface';

@Injectable()
export class DocumentosCitaRepository implements IDocumentosCitaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crearDocumento(
    params: CrearDocumentoCitaParams,
  ): Promise<DocumentoCitaDto> {
    const documento = await this.prisma.documento.create({
      data: {
        expedienteId: params.expedienteId,
        tipo: 'FORMATO_ATENCION_PSICOLOGICA',
        nombreArchivo: params.nombreArchivo,
        claveR2: params.claveR2,
        mimeType: params.mimeType,
        tamanioBytes: params.tamanioBytes,
        subidoPorId: params.subidoPorId,
        citaPsicologicaId: params.citaId,
      },
    });
    return {
      id: documento.id,
      tipo: documento.tipo,
      nombreArchivo: documento.nombreArchivo,
      tamanioBytes: documento.tamanioBytes,
      createdAt: documento.createdAt.toISOString(),
    };
  }

  async buscarDocumentoParaDescarga(
    citaId: string,
  ): Promise<DocumentoCitaParaDescarga | null> {
    return this.prisma.documento.findFirst({
      where: { citaPsicologicaId: citaId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, claveR2: true, nombreArchivo: true },
    });
  }
}
