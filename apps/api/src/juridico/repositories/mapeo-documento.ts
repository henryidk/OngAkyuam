import type { Prisma } from '@prisma/client';
import {
  fechaCalendarioGT,
  horaGT,
  type DocumentoProcesoDto,
} from '@akyuam/shared';

export const INCLUDE_DOCUMENTO = {
  subidoPor: { select: { nombreCompleto: true } },
  audiencia: { select: { id: true, inicio: true } },
} satisfies Prisma.DocumentoProcesoInclude;

type DocumentoConRelaciones = Prisma.DocumentoProcesoGetPayload<{
  include: typeof INCLUDE_DOCUMENTO;
}>;

// `claveR2` nunca sale del backend: el archivo solo se alcanza con una URL firmada.
export function mapearDocumento(
  documento: DocumentoConRelaciones,
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
    audiencia: documento.audiencia
      ? {
          id: documento.audiencia.id,
          fecha: fechaCalendarioGT(documento.audiencia.inicio),
          hora: horaGT(documento.audiencia.inicio),
        }
      : null,
  };
}
