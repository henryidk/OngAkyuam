import { CircleAlert } from 'lucide-react'
import Button from '../ui/Button'
import ConfirmModal from '../ui/ConfirmModal'
import Modal, { CuerpoModal, PieModal } from '../ui/Modal'

interface AvisoCancelarPrimeraCitaProps {
  abierto: boolean
  /** "cita" en Psicología, "consulta" en Medicina. */
  que: 'cita' | 'consulta'
  onSeguir: () => void
  onSalir: () => void
}

/**
 * Al cancelar la primera cita de una referencia: nada se tomó, el caso vuelve a estar disponible
 * para todas. Lo seguro (Esc, la opción por defecto) es seguir agendando.
 */
export function AvisoCancelarPrimeraCita({ abierto, que, onSeguir, onSalir }: AvisoCancelarPrimeraCitaProps) {
  return (
    <ConfirmModal
      abierto={abierto}
      titulo={`No se agendó la ${que}`}
      descripcion="El caso sigue en Área de atención, sin tomar."
      confirmarLabel="Salir"
      cancelarLabel="Seguir agendando"
      onConfirmar={onSalir}
      onCancelar={onSeguir}
    />
  )
}

interface AvisoReservaPerdidaProps {
  /** El mensaje del servidor: quién la tiene reservada o que el caso ya se tomó. */
  mensaje: string
  /** "Volver a Área de atención", "Volver a la ficha". */
  volverEtiqueta: string
  onVolver: () => void
}

/**
 * La referencia ya no se puede agendar desde aquí: otra persona la reservó mientras esta pantalla
 * estaba suspendida o sin internet, o el caso ya se tomó. Solo queda volver; nada se guardó.
 */
export function AvisoReservaPerdida({ mensaje, volverEtiqueta, onVolver }: AvisoReservaPerdidaProps) {
  return (
    <Modal abierto titulo="Ya no puedes agendar este caso" Icono={CircleAlert} ancho="sm" onCerrar={onVolver}>
      <CuerpoModal>
        <p className="text-sm text-gray-700">{mensaje}</p>
        <p className="mt-2 text-sm text-gray-500">No se guardó nada.</p>
      </CuerpoModal>
      <PieModal>
        <Button tamano="md" onClick={onVolver}>
          {volverEtiqueta}
        </Button>
      </PieModal>
    </Modal>
  )
}
