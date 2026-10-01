import { useState } from 'react'
import {
  CONTENIDO_BITACORA_MAX,
  ETIQUETAS_TIPO_ENTRADA_BITACORA,
  TIPOS_ACTUACION_BITACORA,
  registrarActuacionSchema,
  type TipoActuacionBitacora,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { registrarActuacion } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import type { PropsModalProceso } from './contextoDetalle'
import { useEnvio } from './useEnvio'

export default function ModalActuacion({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const [tipo, setTipo] = useState<TipoActuacionBitacora>(TIPOS_ACTUACION_BITACORA[0])
  const [contenido, setContenido] = useState('')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function confirmar() {
    const validado = registrarActuacionSchema.safeParse({ tipo, contenido })
    if (!validado.success) {
      setError('Describa la actuación')
      return
    }
    void enviar(
      () => registrarActuacion(proceso.id, validado.data),
      () => onHecho('Actuación registrada'),
    )
  }

  return (
    <ConfirmModal
      abierto
      titulo="Registrar actuación"
      descripcion={`Queda en la bitácora del proceso ${proceso.codigo} con su nombre y la fecha.`}
      confirmarLabel="Guardar"
      cargando={enviando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>Tipo</span>
        <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoActuacionBitacora)} className={CLASE_CAMPO}>
          {TIPOS_ACTUACION_BITACORA.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS_TIPO_ENTRADA_BITACORA[opcion]}
            </option>
          ))}
        </select>
      </label>
      <label className={CLASE_ETIQUETA}>
        <span>Descripción</span>
        <textarea
          rows={4}
          maxLength={CONTENIDO_BITACORA_MAX}
          value={contenido}
          onChange={(evento) => setContenido(evento.target.value)}
          placeholder="Qué se hizo, qué resolvió el juzgado, qué sigue"
          className={CLASE_CAMPO}
        />
      </label>
    </ConfirmModal>
  )
}
