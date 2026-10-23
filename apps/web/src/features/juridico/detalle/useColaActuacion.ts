import type { DocumentoProcesoDto } from '@akyuam/shared'
import { useColaSubida } from '../../../lib/documentos/useColaSubida'
import { subirDocumentoActuacion } from '../api/juridico.api'

/** Cola de subida cuyo destino es una actuación del proceso: los archivos van a la carpeta "Actuaciones". */
export function useColaActuacion(procesoId: string) {
  return useColaSubida<string, DocumentoProcesoDto>((item, { destino: actuacionId, ...opciones }) =>
    subirDocumentoActuacion(procesoId, actuacionId, item.archivo, item.nombreVisible.trim(), opciones),
  )
}
