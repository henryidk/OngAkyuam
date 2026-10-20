import type { DocumentoProcesoDto } from '@akyuam/shared'
import { useColaSubida } from '../../../lib/documentos/useColaSubida'
import { subirDocumentoAudiencia } from '../api/audiencias.api'

/** Cola de subida cuyo destino es una audiencia: los archivos van a la carpeta "Audiencias". */
export function useColaAudiencia() {
  return useColaSubida<string, DocumentoProcesoDto>((item, { destino: audienciaId, ...opciones }) =>
    subirDocumentoAudiencia(audienciaId, item.archivo, item.nombreVisible.trim(), opciones),
  )
}
