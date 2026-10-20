import type { DocumentoProcesoDto } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import { dispararDescarga } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumento } from '../api/juridico.api'

/** Ver y descargar un documento del proceso con una URL firmada de corta duración. */
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
        mostrar('El navegador bloqueó la ventana. Permita las ventanas emergentes o use Descargar.', 'error')
      }
    } catch (err) {
      ventana?.close()
      mostrar(extraerMensajeError(err), 'error')
    }
  }

  async function descargar(documento: DocumentoProcesoDto) {
    try {
      dispararDescarga(await obtenerUrlDocumento(procesoId, documento.id, 'descarga'))
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    }
  }

  return { ver, descargar }
}
