import { useCallback, useState } from 'react'
import {
  ETIQUETAS_ESTADO_AUDIENCIA,
  OBSERVACIONES_AUDIENCIA_MAX,
  formatFechaGT,
  observacionesAudienciaSchema,
  type AudienciaDetalleDto,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { useRecurso } from '../../../lib/useRecurso'
import { editarObservacionesAudiencia, listarAudienciasProceso } from '../api/audiencias.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { useEnvio } from '../detalle/useEnvio'
import type { PropsModalAudiencia } from './caso'
import { textoCaso } from './formato'

function titulo(audiencia: PropsModalAudiencia['audiencia']) {
  return `${textoCaso(audiencia)} · ${formatFechaGT(audiencia.fecha)} ${audiencia.hora} · ${ETIQUETAS_ESTADO_AUDIENCIA[audiencia.estado]}`
}

function EditorObservaciones({ detalle, onCerrar, onHecho, onConflicto }: PropsModalAudiencia & { detalle: AudienciaDetalleDto }) {
  const [observaciones, setObservaciones] = useState(detalle.observaciones ?? '')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function guardar() {
    const validado = observacionesAudienciaSchema.safeParse({ observaciones, version: detalle.version })
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Revise las observaciones')
      return
    }
    void enviar(
      () => editarObservacionesAudiencia(detalle.id, validado.data),
      () => onHecho('Observaciones guardadas'),
    )
  }

  return (
    <ConfirmModal
      abierto
      amplio
      titulo="Observaciones de la audiencia"
      descripcion={titulo(detalle)}
      confirmarLabel="Guardar"
      cargando={enviando}
      error={error}
      onConfirmar={guardar}
      onCancelar={onCerrar}
    >
      {detalle.motivo && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <span className="font-medium">Motivo: </span>
          {detalle.motivo}
        </p>
      )}
      <label className={CLASE_ETIQUETA}>
        <span>Qué ocurrió en la audiencia</span>
        <textarea
          rows={8}
          maxLength={OBSERVACIONES_AUDIENCIA_MAX}
          value={observaciones}
          onChange={(evento) => {
            setObservaciones(evento.target.value)
            setError(null)
          }}
          className={CLASE_CAMPO}
        />
        <span className="block text-right font-normal text-gray-400 tabular-nums">
          {observaciones.length} / {OBSERVACIONES_AUDIENCIA_MAX}
        </span>
      </label>
      {detalle.documentos.length > 0 && (
        <p className="text-xs text-gray-500">
          {detalle.documentos.length} {detalle.documentos.length === 1 ? 'documento adjunto' : 'documentos adjuntos'} en la
          carpeta Audiencias del proceso.
        </p>
      )}
    </ConfirmModal>
  )
}

/** Ver y completar lo ocurrido después del resultado. La fila no trae el texto: se pide el detalle. */
export default function ModalObservacionesAudiencia(props: PropsModalAudiencia) {
  const { audiencia, onCerrar } = props
  const cargar = useCallback(() => listarAudienciasProceso(audiencia.procesoId), [audiencia.procesoId])
  const { datos, error } = useRecurso(cargar)
  const detalle = datos?.find((una) => una.id === audiencia.id)

  if (detalle) return <EditorObservaciones {...props} detalle={detalle} />
  let mensaje = 'Cargando…'
  if (error) mensaje = error.mensaje
  else if (datos) mensaje = 'La audiencia ya no está disponible.'
  return (
    <ConfirmModal
      abierto
      amplio
      titulo="Observaciones de la audiencia"
      descripcion={titulo(audiencia)}
      confirmarLabel="Guardar"
      confirmarDeshabilitado
      onConfirmar={onCerrar}
      onCancelar={onCerrar}
    >
      <p role="status" className="text-sm text-gray-500">
        {mensaje}
      </p>
    </ConfirmModal>
  )
}
