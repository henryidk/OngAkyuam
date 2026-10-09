import { useState } from 'react'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { marcarNoAsistio } from '../api/psicologia.api'

/** Lo mínimo para marcar una cita: cuál es y cómo nombrarla en la confirmación. */
export interface CitaPorMarcar {
  id: string
  /** "Nombre · P1-05-2026" o la fecha de la cita: lo que identifica a la cita en el aviso. */
  descripcion: string
}

interface ConfirmarNoAsistioProps {
  /** null = cerrado. */
  cita: CitaPorMarcar | null
  onCancelar: () => void
  /**
   * Se intentó marcar. Se avisa también si falló, porque lo más probable es que otra pestaña ya
   * la haya registrado y la pantalla deba refrescarse. Con `marcada` el modal ya puede cerrarse.
   */
  onIntento: (marcada: boolean) => void
}

/** Confirmación de "Marcar no asistió", la misma en la agenda y en el detalle del proceso. */
export default function ConfirmarNoAsistio({ cita, onCancelar, onIntento }: ConfirmarNoAsistioProps) {
  const [marcando, setMarcando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    if (!cita) return
    setMarcando(true)
    setError(null)
    let marcada = false
    try {
      await marcarNoAsistio(cita.id)
      marcada = true
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setMarcando(false)
      onIntento(marcada)
    }
  }

  function cancelar() {
    setError(null)
    onCancelar()
  }

  return (
    <ConfirmModal
      abierto={cita !== null}
      titulo="¿Marcar que no asistió?"
      descripcion={
        cita
          ? `${cita.descripcion}. La cita queda como inasistencia y deja de estar pendiente de registro.`
          : undefined
      }
      confirmarLabel="Marcar no asistió"
      cargando={marcando}
      error={error}
      onConfirmar={() => void confirmar()}
      onCancelar={cancelar}
    />
  )
}
