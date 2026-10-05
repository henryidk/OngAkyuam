import { useEffect, useId, useState } from 'react'
import { CONTENIDO_BITACORA_MAX, LARGO_MAXIMO_TIPO_ACTUACION, registrarActuacionSchema } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { obtenerTiposActuacion, registrarActuacion } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import type { PropsModalProceso } from './contextoDetalle'
import { useEnvio } from './useEnvio'

/** Cuántas sugerencias se muestran como botones; el resto queda en el autocompletado del campo. */
const CHIPS_VISIBLES = 5

type ErroresCampo = Partial<Record<'tipo' | 'contenido', string>>

export default function ModalActuacion({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const [tipo, setTipo] = useState('')
  const [contenido, setContenido] = useState('')
  const [errores, setErrores] = useState<ErroresCampo>({})
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const { enviando, error, enviar } = useEnvio(onConflicto)
  const idLista = useId()

  useEffect(() => {
    let cancelado = false
    // Las sugerencias solo ahorran escritura: si fallan, el campo sigue siendo libre.
    obtenerTiposActuacion(proceso.id)
      .then((tipos) => {
        if (!cancelado) setSugerencias(tipos)
      })
      .catch(() => undefined)
    return () => {
      cancelado = true
    }
  }, [proceso.id])

  function confirmar() {
    const validado = registrarActuacionSchema.safeParse({ tipo, contenido })
    if (!validado.success) {
      const nuevos: ErroresCampo = {}
      for (const issue of validado.error.issues) {
        const campo = issue.path[0]
        if ((campo === 'tipo' || campo === 'contenido') && !nuevos[campo]) nuevos[campo] = issue.message
      }
      setErrores(nuevos)
      return
    }
    setErrores({})
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
      <div className="space-y-2">
        <label className={CLASE_ETIQUETA}>
          <span>Tipo de actuación</span>
          <input
            type="text"
            value={tipo}
            maxLength={LARGO_MAXIMO_TIPO_ACTUACION}
            list={idLista}
            autoComplete="off"
            onChange={(evento) => setTipo(evento.target.value)}
            placeholder="Ej. Memorial de evacuación de audiencia"
            aria-invalid={Boolean(errores.tipo)}
            className={CLASE_CAMPO}
          />
        </label>
        <datalist id={idLista}>
          {sugerencias.map((sugerencia) => (
            <option key={sugerencia} value={sugerencia} />
          ))}
        </datalist>
        {errores.tipo && <p className="text-xs text-red-600">{errores.tipo}</p>}
        {sugerencias.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Sugerencias:</span>
            {sugerencias.slice(0, CHIPS_VISIBLES).map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                onClick={() => setTipo(sugerencia)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-700 hover:border-brand-600 hover:text-brand-700"
              >
                {sugerencia}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className={CLASE_ETIQUETA}>
          <span>Descripción</span>
          <textarea
            rows={4}
            maxLength={CONTENIDO_BITACORA_MAX}
            value={contenido}
            onChange={(evento) => setContenido(evento.target.value)}
            placeholder="Qué se hizo, qué resolvió el juzgado, qué sigue"
            aria-invalid={Boolean(errores.contenido)}
            className={CLASE_CAMPO}
          />
        </label>
        {errores.contenido && <p className="text-xs text-red-600">{errores.contenido}</p>}
      </div>
    </ConfirmModal>
  )
}
