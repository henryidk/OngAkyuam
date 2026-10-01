import type { Prisma } from '@prisma/client';
import type { DocumentoProcesoDto } from '@akyuam/shared';

export const INCLUDE_SUBIDO_POR = {
  subidoPor: { select: { nombreCompleto: true } },
} satisfies Prisma.DocumentoProcesoInclude;

type DocumentoConAutor = Prisma.DocumentoProcesoGetPayload<{
  include: typeof INCLUDE_SUBIDO_POR;
}>;

// `claveR2` nunca sale del backend: el archivo solo se alcanza con una URL firmada.
export function mapearDocumento(
  documento: DocumentoConAutor,
): DocumentoProcesoDto {
  return {
    id: documento.id,
    carpetaId: documento.carpetaId,
    nombreVisible: documento.nombreVisible,
    nombreArchivo: documento.nombreArchivo,
    mimeType: documento.mimeType,
    tamanioBytes: documento.tamanioBytes,
    subidoPor: documento.subidoPor.nombreCompleto,
    createdAt: documento.createdAt.toISOString(),
  };
}
