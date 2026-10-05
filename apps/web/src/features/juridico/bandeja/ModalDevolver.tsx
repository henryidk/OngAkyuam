import { useState } from 'react'
import { devolverReferenciaSchema, MOTIVO_DEVOLUCION_MAX, type ReferenciaBandejaDto } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { devolverReferencia } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'

interface ModalDevolverProps {
  /** Solo hace falta el id: sirve tanto desde la bandeja como desde la ficha de la usuaria. */
  referencia: Pick<ReferenciaBandejaDto, 'referidoId'>
  onCerrar: () => void
  onDevuelta: () => void
}

export default function ModalDevolver({ referencia, onCerrar, onDevuelta }: ModalDevolverProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    const validado = devolverReferenciaSchema.safeParse({ motivo })
    if (!validado.success) {
      setError('Escriba la observación para Trabajo Social')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await devolverReferencia(referencia.referidoId, validado.data)
      onDevuelta()
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ConfirmModal
      abierto
      titulo="Devolver referencia a Trabajo Social"
      descripcion="Para casos que no son competencia de Jurídico o llegan con información incompleta."
      confirmarLabel="Devolver"
      cargando={enviando}
      error={error}
      onConfirmar={() => void confirmar()}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>Observación</span>
        <textarea
          rows={3}
          maxLength={MOTIVO_DEVOLUCION_MAX}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Ej. Falta DPI y datos del demandado"
          className={CLASE_CAMPO}
        />
      </label>
    </ConfirmModal>
  )
}
