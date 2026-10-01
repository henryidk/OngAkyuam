import { useState } from 'react'
import {
  ETIQUETAS_MOTIVO_ABANDONO,
  INTENTOS_CONTACTO_MAX,
  MOTIVOS_ABANDONO_PROCESO,
  OBSERVACIONES_ABANDONO_MAX,
  hoyGT,
  registrarAbandonoSchema,
  type MotivoAbandonoProceso,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { registrarAbandono } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import type { PropsModalProceso } from './contextoDetalle'
import { useEnvio } from './useEnvio'

export default function ModalAbandono({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const [motivoCatalogo, setMotivoCatalogo] = useState<MotivoAbandonoProceso | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [ultimoContacto, setUltimoContacto] = useState('')
  const [intentos, setIntentos] = useState('0')
  const [notificarTs, setNotificarTs] = useState(true)
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function confirmar() {
    if (!motivoCatalogo) {
      setError('Elija el motivo del abandono')
      return
    }
    const validado = registrarAbandonoSchema.safeParse({
      motivoCatalogo,
      observaciones,
      ultimoContacto,
      intentos: Number(intentos),
      notificarTs,
      version: proceso.version,
    })
    if (!validado.success) {
      setError('Revise los datos: los intentos de contacto deben ser un número entero')
      return
    }
    void enviar(
      () => registrarAbandono(proceso.id, validado.data),
      () => onHecho('Abandono registrado'),
    )
  }

  return (
    <ConfirmModal
      abierto
      titulo="Registrar abandono del caso"
      descripcion={`${proceso.codigo} · El proceso queda como abandonado y puede reactivarse si la usuaria regresa.`}
      confirmarLabel="Registrar abandono"
      peligro
      cargando={enviando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>Motivo</span>
        <select
          value={motivoCatalogo}
          onChange={(evento) => setMotivoCatalogo(evento.target.value as MotivoAbandonoProceso | '')}
          className={CLASE_CAMPO}
        >
          <option value="">Seleccione un motivo</option>
          {MOTIVOS_ABANDONO_PROCESO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS_MOTIVO_ABANDONO[opcion]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={CLASE_ETIQUETA}>
          <span>Último contacto</span>
          <input
            type="date"
            value={ultimoContacto}
            max={hoyGT()}
            onChange={(evento) => setUltimoContacto(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
        <label className={CLASE_ETIQUETA}>
          <span>Intentos de contacto</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={INTENTOS_CONTACTO_MAX}
            value={intentos}
            onChange={(evento) => setIntentos(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
      </div>
      <label className={CLASE_ETIQUETA}>
        <span>Observaciones (opcional)</span>
        <textarea
          rows={3}
          maxLength={OBSERVACIONES_ABANDONO_MAX}
          value={observaciones}
          onChange={(evento) => setObservaciones(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={notificarTs}
          onChange={(evento) => setNotificarTs(evento.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        Notificar a Trabajo Social para seguimiento
      </label>
    </ConfirmModal>
  )
}
