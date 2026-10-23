import { formatInstanteGT, type EntradaBitacoraDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import MarcoModalAudiencia from '../audiencias/MarcoModalAudiencia'
import ColaArchivos from '../documentos/ColaArchivos'
import { useColaActuacion } from './useColaActuacion'

interface ModalDocumentosActuacionProps {
  procesoId: string
  actuacion: EntradaBitacoraDto
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}

/** Escrito, resolución o notificación de una actuación ya registrada: quedan en la carpeta "Actuaciones". */
export default function ModalDocumentosActuacion({ procesoId, actuacion, onCerrar, onHecho }: ModalDocumentosActuacionProps) {
  const cola = useColaActuacion(procesoId)
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
      subtitulo={`${actuacion.tipo} · ${formatInstanteGT(actuacion.createdAt)}`}
      onCerrar={cerrar}
      pie={
        <>
          {cola.fase === 'edicion' && (
            <>
              <Button variante="secondary" tamano="md" onClick={cerrar}>
                Cancelar
              </Button>
              <Button tamano="md" onClick={() => void cola.iniciar(actuacion.id)} disabled={pendientes === 0}>
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
      <p className="text-[13px] text-gray-500">
        PDF, JPG, PNG o WEBP · máximo 15 MB por archivo. Se guardan en la carpeta Actuaciones.
      </p>
      <ColaArchivos cola={cola} />
    </MarcoModalAudiencia>
  )
}
