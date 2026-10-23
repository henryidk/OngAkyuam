import type { DocumentoProcesoDto } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumento } from '../api/juridico.api'

/**
 * Ver un documento del proceso con una URL firmada de corta duración. En Jurídico los documentos
 * solo se ven: no se ofrece descargarlos.
 */
export function useAbrirDocumento(procesoId: string) {
  const { mostrar } = useToast()

  // La ventana se abre dentro del clic (si se abriera después de esperar la URL, el navegador
  // la bloquearía como ventana emergente) y se le asigna la URL firmada cuando llega.
  async function ver(documento: DocumentoProcesoDto) {
    const ventana = window.open('', '_blank')
    try {
      const url = await obtenerUrlDocumento(procesoId, documento.id, 'vista')
      if (ventana) {
        ventana.opener = null
        ventana.location.replace(url)
      } else {
        mostrar('El navegador bloqueó la ventana. Permita las ventanas emergentes para este sitio.', 'error')
      }
    } catch (err) {
      ventana?.close()
      mostrar(extraerMensajeError(err), 'error')
    }
  }

  return { ver }
}
