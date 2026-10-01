import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizarNombreCarpeta, type CarpetaDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CrearCarpetaParams,
  ICarpetasRepository,
  RenombrarCarpetaParams,
  ResultadoRenombrarCarpeta,
} from '../interfaces/documentos-proceso-repository.interface';
import { INCLUDE_SUBIDO_POR, mapearDocumento } from './mapeo-documento';

function esNombreDuplicado(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class CarpetasRepository implements ICarpetasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarConDocumentos(procesoId: string): Promise<CarpetaDto[]> {
    const carpetas = await this.prisma.carpetaDocumentoProceso.findMany({
      where: { procesoId },
      include: {
        documentos: {
          include: INCLUDE_SUBIDO_POR,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return carpetas.map((carpeta) => ({
      id: carpeta.id,
      nombre: carpeta.nombre,
      documentos: carpeta.documentos.map(mapearDocumento),
    }));
  }

  async crear(params: CrearCarpetaParams): Promise<CarpetaDto | null> {
    try {
      const carpeta = await this.prisma.carpetaDocumentoProceso.create({
        data: {
          procesoId: params.procesoId,
          nombre: params.nombre,
          nombreNorm: normalizarNombreCarpeta(params.nombre),
          creadaPorId: params.creadaPorId,
        },
      });
      return { id: carpeta.id, nombre: carpeta.nombre, documentos: [] };
    } catch (error) {
      if (esNombreDuplicado(error)) {
        return null;
      }
      throw error;
    }
  }

  async renombrar(
    params: RenombrarCarpetaParams,
  ): Promise<ResultadoRenombrarCarpeta> {
    try {
      const { count } = await this.prisma.carpetaDocumentoProceso.updateMany({
        where: { id: params.carpetaId, procesoId: params.procesoId },
        data: {
          nombre: params.nombre,
          nombreNorm: normalizarNombreCarpeta(params.nombre),
        },
      });
      return count === 1 ? 'RENOMBRADA' : 'INEXISTENTE';
    } catch (error) {
      if (esNombreDuplicado(error)) {
        return 'NOMBRE_DUPLICADO';
      }
      throw error;
    }
  }

  async perteneceAlProceso(
    carpetaId: string,
    procesoId: string,
  ): Promise<boolean> {
    const carpeta = await this.prisma.carpetaDocumentoProceso.findFirst({
      where: { id: carpetaId, procesoId },
      select: { id: true },
    });
    return carpeta !== null;
  }
}
