import { useState } from 'react'
import { MOTIVO_AUDIENCIA_MAX, cancelarAudienciaSchema, formatFechaGT } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { cancelarAudiencia } from '../api/audiencias.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { useEnvio } from '../detalle/useEnvio'
import type { PropsModalAudiencia } from './caso'
import { textoCaso } from './formato'

export default function ModalCancelarAudiencia({ audiencia, onCerrar, onHecho, onConflicto }: PropsModalAudiencia) {
  const [motivo, setMotivo] = useState('')
  const [agendarOtra, setAgendarOtra] = useState(false)
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function confirmar() {
    const validado = cancelarAudienciaSchema.safeParse({ motivo, version: audiencia.version })
    if (!validado.success) {
      setError('Escriba el motivo de la cancelación')
      return
    }
    void enviar(
      () => cancelarAudiencia(audiencia.id, validado.data),
      () => onHecho('Audiencia cancelada', agendarOtra ? { tipo: 'AGENDAR_NUEVA_FECHA', audiencia } : undefined),
    )
  }

  return (
    <ConfirmModal
      abierto
      peligro
      titulo="Cancelar audiencia"
      descripcion={`${textoCaso(audiencia)} · ${formatFechaGT(audiencia.fecha)} ${audiencia.hora}. Queda en el historial como cancelada.`}
      confirmarLabel="Cancelar audiencia"
      cancelarLabel="Volver"
      cargando={enviando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>Motivo</span>
        <textarea
          rows={3}
          maxLength={MOTIVO_AUDIENCIA_MAX}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Ej. El juzgado dejó sin efecto la diligencia"
          className={CLASE_CAMPO}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={agendarOtra} onChange={(evento) => setAgendarOtra(evento.target.checked)} />
        Agendar una nueva fecha ahora
      </label>
    </ConfirmModal>
  )
}
