import { useState } from 'react'
import { CONTENIDO_BITACORA_MAX, LARGO_MAXIMO_TIPO_ACTUACION, registrarActuacionSchema } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { registrarActuacion } from '../api/juridico.api'
import MarcoModalAudiencia from '../audiencias/MarcoModalAudiencia'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import ColaArchivos from '../documentos/ColaArchivos'
import type { PropsModalProceso } from './contextoDetalle'
import { useColaActuacion } from './useColaActuacion'
import { useEnvio } from './useEnvio'

type ErroresCampo = Partial<Record<'tipo' | 'contenido', string>>

/**
 * Registrar una actuación y, en el mismo paso, adjuntar el escrito o la resolución. Primero se
 * guarda la actuación; los archivos se suben después, cada uno por su cuenta: si uno falla, la
 * actuación ya quedó y ese archivo se puede reintentar.
 */
export default function ModalActuacion({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const [tipo, setTipo] = useState('')
  const [contenido, setContenido] = useState('')
  const [errores, setErrores] = useState<ErroresCampo>({})
  const [guardado, setGuardado] = useState(false)
  const { enviando, error, enviar } = useEnvio(onConflicto)
  const cola = useColaActuacion(proceso.id)

  const terminar = () => onHecho('Avance registrado')

  function guardar() {
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
      (entrada) => {
        if (cola.items.some((item) => item.estado === 'pendiente')) {
          setGuardado(true)
          void cola.iniciar(entrada.id)
        } else {
          terminar()
        }
      },
    )
  }

  const subiendo = cola.fase === 'subiendo'
  const cerrar = () => {
    if (enviando || subiendo) return
    if (guardado) terminar()
    else onCerrar()
  }

  return (
    <MarcoModalAudiencia
      titulo="Registrar avance"
      subtitulo={`Queda en la bitácora del proceso ${proceso.codigo} con su nombre y la fecha.`}
      onCerrar={cerrar}
      pie={
        guardado ? (
          <Button tamano="md" onClick={terminar} disabled={subiendo}>
            Listo
          </Button>
        ) : (
          <>
            <Button variante="secondary" tamano="md" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button tamano="md" onClick={guardar} cargando={enviando}>
              Guardar
            </Button>
          </>
        )
      }
    >
      {guardado ? (
        <p role="status" className="text-sm font-medium text-gray-900">
          Avance guardado. {subiendo ? 'Subiendo documentos…' : 'Revise los documentos antes de cerrar.'}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <label className={CLASE_ETIQUETA}>
              <span>Tipo de avance</span>
              <input
                type="text"
                value={tipo}
                maxLength={LARGO_MAXIMO_TIPO_ACTUACION}
                autoComplete="off"
                onChange={(evento) => setTipo(evento.target.value)}
                placeholder="Ej. Memorial de evacuación de audiencia"
                aria-invalid={Boolean(errores.tipo)}
                className={CLASE_CAMPO}
              />
            </label>
            {errores.tipo && <p className="text-xs text-red-600">{errores.tipo}</p>}
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

          <p className="text-xs font-medium text-gray-600">Documentos (escrito, resolución, notificación) · opcional</p>
        </>
      )}

      <ColaArchivos cola={cola} />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </MarcoModalAudiencia>
  )
}
