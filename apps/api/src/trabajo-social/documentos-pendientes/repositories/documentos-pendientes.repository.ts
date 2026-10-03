import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CrearDocumentoPendienteParams,
  DocumentoPendienteCreado,
  DocumentoPendienteVencido,
  IDocumentosPendientesRepository,
} from '../interfaces/documentos-pendientes-repository.interface';

@Injectable()
export class DocumentosPendientesRepository implements IDocumentosPendientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(
    params: CrearDocumentoPendienteParams,
  ): Promise<DocumentoPendienteCreado> {
    return this.prisma.documentoPendiente.create({
      data: params,
      select: { id: true, tipo: true, nombreArchivo: true, tamanioBytes: true },
    });
  }

  async eliminarDeUsuario(
    id: string,
    subidoPorId: string,
  ): Promise<string | null> {
    try {
      const borrado = await this.prisma.documentoPendiente.delete({
        where: { id, subidoPorId },
        select: { claveR2: true },
      });
      return borrado.claveR2;
    } catch (error) {
      // P2025: no existe (ya adjuntado, vencido) o lo subió otra persona.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async listarVencidos(
    limite: Date,
    maximo: number,
  ): Promise<DocumentoPendienteVencido[]> {
    return this.prisma.documentoPendiente.findMany({
      where: { createdAt: { lt: limite } },
      orderBy: { createdAt: 'asc' },
      take: maximo,
      select: { id: true, claveR2: true },
    });
  }

  async eliminar(id: string): Promise<void> {
    // deleteMany para que no falle si otra limpieza concurrente ya la borró.
    await this.prisma.documentoPendiente.deleteMany({ where: { id } });
  }
}
