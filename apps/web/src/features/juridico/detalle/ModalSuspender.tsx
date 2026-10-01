import { useState } from 'react'
import { MOTIVO_SUSPENSION_MAX, suspenderProcesoSchema } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { suspenderProceso } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import type { PropsModalProceso } from './contextoDetalle'
import { useEnvio } from './useEnvio'

export default function ModalSuspender({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const [motivo, setMotivo] = useState('')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function confirmar() {
    const validado = suspenderProcesoSchema.safeParse({ motivo, version: proceso.version })
    if (!validado.success) {
      setError('Escriba el motivo de la suspensión')
      return
    }
    void enviar(
      () => suspenderProceso(proceso.id, validado.data),
      () => onHecho('Proceso suspendido'),
    )
  }

  return (
    <ConfirmModal
      abierto
      titulo="Suspender temporalmente"
      descripcion="El proceso queda en pausa y puede reactivarse cuando se retome."
      confirmarLabel="Suspender"
      cargando={enviando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>Motivo</span>
        <textarea
          rows={3}
          maxLength={MOTIVO_SUSPENSION_MAX}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Ej. En espera de dictamen INACIF"
          className={CLASE_CAMPO}
        />
      </label>
    </ConfirmModal>
  )
}
