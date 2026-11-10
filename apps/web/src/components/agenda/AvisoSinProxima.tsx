import { TriangleAlert } from 'lucide-react'
import Button from '../ui/Button'
import Modal, { CuerpoModal, PieModal } from '../ui/Modal'

interface AvisoSinProximaProps {
  abierto: boolean
  /** "cita" en Psicología, "consulta" en Medicina. */
  que: 'cita' | 'consulta'
  /** Quién queda sin próxima: la persona de la sesión o las de la visita. */
  persona: string
  /** Son varias personas (una visita familiar): "quedan". */
  varias?: boolean
  /** Dónde se le va a encontrar después, p. ej. «Sin próxima cita». */
  dondeQueda: string
  /** El botón de seguir sin programar, p. ej. "Registrar sin próxima cita". */
  guardarLabel: string
  /** Cierra el aviso y deja elegida la opción de programar. */
  onProgramar: () => void
  onGuardar: () => void
  /** Esc o la X: vuelve al formulario sin cambiar nada. */
  onVolver: () => void
}

/**
 * Al guardar sin próxima cita: nadie la tiene agendada y el seguimiento depende de que alguien la
 * busque en su lista. Interrumpe a propósito (lo pidió el equipo): es fácil pasarlo por alto y
 * el costo es que una sobreviviente deje de ser atendida. Lo seguro va primero: programarla.
 */
export default function AvisoSinProxima({
  abierto,
  que,
  persona,
  varias = false,
  dondeQueda,
  guardarLabel,
  onProgramar,
  onGuardar,
  onVolver,
}: AvisoSinProximaProps) {
  return (
    <Modal
      abierto={abierto}
      titulo={`¿Guardar sin próxima ${que}?`}
      Icono={TriangleAlert}
      tonoIcono="aviso"
      ancho="sm"
      onCerrar={onVolver}
    >
      <CuerpoModal className="space-y-2">
        <p className="text-[15px] font-medium text-gray-900">
          {persona} {varias ? 'quedan' : 'queda'} sin ninguna {que} en la agenda.
        </p>
        <p className="text-sm text-gray-600">
          Sin una fecha agendada, el seguimiento depende de que alguien revise {dondeQueda}. Si ya
          sabes cuándo es la próxima, prográmala ahora.
        </p>
      </CuerpoModal>
      <PieModal>
        <Button variante="secondary" tamano="md" onClick={onGuardar}>
          {guardarLabel}
        </Button>
        <Button tamano="md" onClick={onProgramar}>
          Programar la próxima {que}
        </Button>
      </PieModal>
    </Modal>
  )
}
