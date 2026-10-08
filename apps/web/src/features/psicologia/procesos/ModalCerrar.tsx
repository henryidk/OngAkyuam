import { useState } from 'react'
import {
  ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA,
  MOTIVOS_CIERRE_PSICOLOGIA,
  RESUMEN_CIERRE_PSICOLOGIA_MAX,
  cerrarProcesoPsicologiaSchema,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'
import { useEnvio } from '../../juridico/detalle/useEnvio'
import { cerrarProceso } from '../api/psicologia.api'
import type { PropsModalProceso } from './contextoDetalle'

/** Cerrar el proceso. No se reabre: si la usuaria vuelve, se le abre uno nuevo. */
export default function ModalCerrar({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)
  const [motivo, setMotivo] = useState('')
  const [resumen, setResumen] = useState('')

  function confirmar() {
    const validacion = cerrarProcesoPsicologiaSchema.safeParse({ motivo, resumen, version: proceso.version })
    if (!validacion.success) {
      setError(motivo ? (validacion.error.issues[0]?.message ?? 'Revisa los datos del cierre.') : 'Elige el motivo de cierre.')
      return
    }
    void enviar(
      async () => {
        const cerrado = await cerrarProceso(proceso.id, validacion.data)
        let mensaje = 'Proceso cerrado'
        if (cerrado.citasCanceladas === 1) mensaje += ' · se canceló 1 cita programada'
        else if (cerrado.citasCanceladas > 1) mensaje += ` · se cancelaron ${cerrado.citasCanceladas} citas programadas`
        onHecho(mensaje)
      },
      () => undefined,
    )
  }

  return (
    <ConfirmModal
      abierto
      peligro
      titulo="Cerrar proceso"
      descripcion={`${proceso.codigo} · ${proceso.usuariaNombreCompleto}`}
      confirmarLabel="Cerrar proceso"
      cargando={enviando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        Motivo de cierre
        <select value={motivo} onChange={(evento) => setMotivo(evento.target.value)} className={CLASE_CAMPO}>
          <option value="">Elige un motivo…</option>
          {MOTIVOS_CIERRE_PSICOLOGIA.map((uno) => (
            <option key={uno} value={uno}>
              {ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA[uno]}
            </option>
          ))}
        </select>
      </label>
      <label className={CLASE_ETIQUETA}>
        Resumen del cierre{motivo === 'OTRO' ? '' : ' (opcional)'}
        <textarea
          value={resumen}
          onChange={(evento) => setResumen(evento.target.value)}
          rows={4}
          maxLength={RESUMEN_CIERRE_PSICOLOGIA_MAX}
          className={CLASE_CAMPO}
        />
      </label>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        El cierre no se deshace y cancela las citas que el proceso tenga programadas. Si la usuaria necesita volver,
        se le abre un proceso nuevo.
      </p>
    </ConfirmModal>
  )
}
