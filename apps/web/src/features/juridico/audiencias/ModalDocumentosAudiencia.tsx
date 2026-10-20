import { formatFechaGT } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import ColaArchivos from '../documentos/ColaArchivos'
import type { PropsModalAudiencia } from './caso'
import { textoCaso } from './formato'
import MarcoModalAudiencia from './MarcoModalAudiencia'
import { useColaAudiencia } from './useColaAudiencia'

/** Citación, acta o constancia de una audiencia: quedan en la carpeta "Audiencias" del proceso. */
export default function ModalDocumentosAudiencia({ audiencia, onCerrar, onHecho }: Omit<PropsModalAudiencia, 'onConflicto'>) {
  const cola = useColaAudiencia()
  const subidos = cola.items.filter((item) => item.estado === 'listo').length
  const pendientes = cola.items.filter((item) => item.estado === 'pendiente').length

  function cerrar() {
    if (cola.fase === 'subiendo') return
    if (subidos > 0) onHecho(subidos === 1 ? 'Documento adjuntado' : `${subidos} documentos adjuntados`)
    else onCerrar()
  }

  return (
    <MarcoModalAudiencia
      titulo="Adjuntar documentos"
      subtitulo={`${textoCaso(audiencia)} · audiencia del ${formatFechaGT(audiencia.fecha)} ${audiencia.hora}`}
      onCerrar={cerrar}
      pie={
        <>
          {cola.fase === 'edicion' && (
            <>
              <Button variante="secondary" tamano="md" onClick={cerrar}>
                Cancelar
              </Button>
              <Button tamano="md" onClick={() => void cola.iniciar(audiencia.id)} disabled={pendientes === 0}>
                {pendientes <= 1 ? 'Subir documento' : `Subir ${pendientes} documentos`}
              </Button>
            </>
          )}
          {cola.fase === 'subiendo' && (
            <Button variante="secondary" tamano="md" onClick={cola.cancelar}>
              Cancelar subida
            </Button>
          )}
          {cola.fase === 'resultado' && (
            <Button tamano="md" onClick={cerrar}>
              Listo
            </Button>
          )}
        </>
      }
    >
      <p className="text-[13px] text-gray-500">PDF, JPG, PNG o WEBP · máximo 15 MB por archivo. Se guardan en la carpeta Audiencias.</p>
      <ColaArchivos cola={cola} />
    </MarcoModalAudiencia>
  )
}
