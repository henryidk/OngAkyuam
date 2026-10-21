import { ConflictException, Injectable } from '@nestjs/common';
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
    const documento = await this.prisma.$transaction(async (tx) => {
      const cita = await tx.citaPsicologica.findUnique({
        where: { id: params.citaId },
        select: { atencionId: true },
      });
      if (!cita) throw new ConflictException('La cita ya no está disponible');
      const proceso = await tx.atencionPsicologica.updateMany({
        where: { id: cita.atencionId, estado: { not: 'CIERRE' } },
        data: { version: { increment: 0 } },
      });
      if (proceso.count !== 1)
        throw new ConflictException('El proceso está cerrado');
      const bloqueada = await tx.citaPsicologica.updateMany({
        where: {
          id: params.citaId,
          atendidoPorId: params.subidoPorId,
          estado: { not: 'REPROGRAMADA' },
        },
        data: { atendidoPorId: params.subidoPorId },
      });
      if (bloqueada.count !== 1)
        throw new ConflictException(
          'La cita cambió de profesional o fue reprogramada. Actualiza la página.',
        );
      return tx.documento.create({
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
