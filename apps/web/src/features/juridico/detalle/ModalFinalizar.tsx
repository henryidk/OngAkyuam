import { useState } from 'react'
import {
  DESCRIPCIONES_FORMA_FINALIZACION,
  DETALLE_FINALIZACION_MAX,
  ETIQUETAS_FORMA_FINALIZACION,
  FORMAS_FINALIZACION_PROCESO,
  finalizarProcesoSchema,
  hoyGT,
  type FormaFinalizacionProceso,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { finalizarProceso } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import type { PropsModalProceso } from './contextoDetalle'
import { useEnvio } from './useEnvio'

export default function ModalFinalizar({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const hoy = hoyGT()
  const [forma, setForma] = useState<FormaFinalizacionProceso | null>(null)
  const [detalle, setDetalle] = useState('')
  const [fechaCierre, setFechaCierre] = useState(hoy)
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function confirmar() {
    if (!forma) {
      setError('Elija cómo finalizó el proceso')
      return
    }
    const validado = finalizarProcesoSchema.safeParse({ forma, detalle, fechaCierre, version: proceso.version })
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Revise los datos')
      return
    }
    void enviar(
      () => finalizarProceso(proceso.id, validado.data),
      () => onHecho('Proceso finalizado'),
    )
  }

  return (
    <ConfirmModal
      abierto
      titulo="Finalizar proceso"
      descripcion={`${proceso.codigo} · Un proceso finalizado ya no puede reabrirse.`}
      confirmarLabel="Finalizar proceso"
      cargando={enviando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-gray-600">Forma de finalización</legend>
        {FORMAS_FINALIZACION_PROCESO.map((opcion) => (
          <label
            key={opcion}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${
              forma === opcion ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="forma-finalizacion"
              checked={forma === opcion}
              onChange={() => setForma(opcion)}
              className="mt-0.5 h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{ETIQUETAS_FORMA_FINALIZACION[opcion]}</span>
              <span className="block text-xs text-gray-500">{DESCRIPCIONES_FORMA_FINALIZACION[opcion]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className={CLASE_ETIQUETA}>
        <span>{forma === 'OTROS' ? 'Especifique la forma de finalización' : 'Detalle (opcional)'}</span>
        <input
          type="text"
          value={detalle}
          maxLength={DETALLE_FINALIZACION_MAX}
          onChange={(evento) => setDetalle(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      <label className={CLASE_ETIQUETA}>
        <span>Fecha de cierre</span>
        <input
          type="date"
          value={fechaCierre}
          min={proceso.fechaInicio}
          max={hoy}
          onChange={(evento) => setFechaCierre(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      <p className="text-xs text-gray-500">
        Recuerde adjuntar el convenio, la sentencia o la resolución final en Documentos.
      </p>
    </ConfirmModal>
  )
}
