import { Injectable } from '@nestjs/common';
import { Prisma, type Documento } from '@prisma/client';
import {
  TIPOS_DOCUMENTO_TRABAJO_SOCIAL,
  type VersionDocumento,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DocumentoYaReemplazadoError,
  type CrearDocumentoParams,
  type CrearVersionParams,
  type DocumentoCreado,
  type DocumentoParaDescarga,
  type DocumentoParaVersionar,
  type DocumentoVigente,
  type ExpedienteParaDocumento,
  type IDocumentosRepository,
} from '../interfaces/documentos-repository.interface';

const TIPOS_VERSIONADOS = [...TIPOS_DOCUMENTO_TRABAJO_SOCIAL];

const SELECT_AUTOR = {
  subidoPor: { select: { nombreCompleto: true } },
} as const;

type DocumentoConAutor = Documento & { subidoPor: { nombreCompleto: string } };

function aVersionDocumento(documento: DocumentoConAutor): VersionDocumento {
  return {
    id: documento.id,
    version: documento.version,
    vigente: documento.vigente,
    nombreArchivo: documento.nombreArchivo,
    mimeType: documento.mimeType,
    tamanioBytes: documento.tamanioBytes,
    createdAt: documento.createdAt.toISOString(),
    subidoPor: documento.subidoPor.nombreCompleto,
  };
}

function aDocumentoCreado(documento: Documento): DocumentoCreado {
  return {
    id: documento.id,
    tipo: documento.tipo,
    version: documento.version,
    nombreArchivo: documento.nombreArchivo,
    tamanioBytes: documento.tamanioBytes,
    createdAt: documento.createdAt,
  };
}

@Injectable()
export class DocumentosRepository implements IDocumentosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpediente(
    expedienteId: string,
  ): Promise<ExpedienteParaDocumento | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: {
        numero: true,
        tipoRegistro: true,
        fechaEgresoAlbergue: true,
        referidos: { select: { area: true } },
      },
    });
    if (!expediente) {
      return null;
    }
    return {
      numero: expediente.numero,
      tipoRegistro: expediente.tipoRegistro,
      tieneEgresoAlbergue: expediente.fechaEgresoAlbergue !== null,
      areasReferidas: expediente.referidos.map((referido) => referido.area),
    };
  }

  async existeVigente(
    expedienteId: string,
    tipo: Documento['tipo'],
  ): Promise<boolean> {
    const documento = await this.prisma.documento.findFirst({
      where: { expedienteId, tipo, vigente: true },
      select: { id: true },
    });
    return documento !== null;
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

    return aDocumentoCreado(documento);
  }

  async buscarParaVersionar(
    documentoId: string,
    expedienteId: string,
  ): Promise<DocumentoParaVersionar | null> {
    return this.prisma.documento.findFirst({
      where: { id: documentoId, expedienteId },
      select: {
        id: true,
        expedienteId: true,
        tipo: true,
        version: true,
        vigente: true,
      },
    });
  }

  async crearVersion(params: CrearVersionParams): Promise<DocumentoCreado> {
    try {
      const documento = await this.prisma.$transaction(async (tx) => {
        // El filtro `vigente: true` es el candado: si otra subida ganó la carrera, no se
        // actualiza ninguna fila y no se crea una segunda versión vigente.
        const reemplazados = await tx.documento.updateMany({
          where: { id: params.anterior.id, vigente: true },
          data: { vigente: false },
        });
        if (reemplazados.count === 0) {
          throw new DocumentoYaReemplazadoError();
        }

        const creado = await tx.documento.create({
          data: {
            expedienteId: params.anterior.expedienteId,
            tipo: params.anterior.tipo,
            version: params.anterior.version + 1,
            reemplazaAId: params.anterior.id,
            nombreArchivo: params.nombreArchivo,
            claveR2: params.claveR2,
            mimeType: params.mimeType,
            tamanioBytes: params.tamanioBytes,
            subidoPorId: params.subidoPorId,
          },
        });

        // Se conserva quién otorgó cada acceso originalmente: reemplazar el archivo no es
        // una nueva decisión de visibilidad.
        const visibilidadAnterior = await tx.documentoVisibilidadArea.findMany({
          where: { documentoId: params.anterior.id },
          select: { area: true, otorgadoPorId: true },
        });
        if (visibilidadAnterior.length > 0) {
          await tx.documentoVisibilidadArea.createMany({
            data: visibilidadAnterior.map((visibilidad) => ({
              documentoId: creado.id,
              area: visibilidad.area,
              otorgadoPorId: visibilidad.otorgadoPorId,
            })),
          });
        }

        return creado;
      });
      return aDocumentoCreado(documento);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('reemplazaAId')
      ) {
        throw new DocumentoYaReemplazadoError();
      }
      throw error;
    }
  }

  async listarVigentes(expedienteId: string): Promise<DocumentoVigente[]> {
    const documentos = await this.prisma.documento.findMany({
      where: { expedienteId, vigente: true, tipo: { in: TIPOS_VERSIONADOS } },
      include: {
        ...SELECT_AUTOR,
        visibilidadAreas: { select: { area: true } },
      },
    });
    return documentos.map((documento) => ({
      ...aVersionDocumento(documento),
      tipo: documento.tipo,
      areasVisibles: documento.visibilidadAreas.map(
        (visibilidad) => visibilidad.area,
      ),
    }));
  }

  async listarVersiones(
    documentoId: string,
    expedienteId: string,
  ): Promise<VersionDocumento[] | null> {
    const documento = await this.prisma.documento.findFirst({
      where: { id: documentoId, expedienteId },
      select: { tipo: true },
    });
    if (!documento) {
      return null;
    }
    const esVersionado = (TIPOS_VERSIONADOS as string[]).includes(
      documento.tipo,
    );
    const versiones = await this.prisma.documento.findMany({
      where: esVersionado
        ? { expedienteId, tipo: documento.tipo }
        : { id: documentoId },
      include: SELECT_AUTOR,
      orderBy: { version: 'desc' },
    });
    return versiones.map(aVersionDocumento);
  }

  async buscarParaDescarga(
    documentoId: string,
    expedienteId: string,
  ): Promise<DocumentoParaDescarga | null> {
    return this.prisma.documento.findFirst({
      where: { id: documentoId, expedienteId },
      select: { claveR2: true, nombreArchivo: true, mimeType: true },
    });
  }
}
