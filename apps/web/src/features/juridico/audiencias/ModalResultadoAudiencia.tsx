import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import {
  MOTIVO_AUDIENCIA_MAX,
  NUMERO_JUDICIAL_MAX,
  OBSERVACIONES_AUDIENCIA_MAX,
  formatFechaGT,
  registrarResultadoAudienciaSchema,
  type ResultadoAudiencia,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { registrarResultadoAudiencia } from '../api/audiencias.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { useEnvio } from '../detalle/useEnvio'
import ColaArchivos from '../documentos/ColaArchivos'
import type { PropsModalAudiencia } from './caso'
import { textoCaso } from './formato'
import MarcoModalAudiencia from './MarcoModalAudiencia'
import { useColaAudiencia } from './useColaAudiencia'

const OPCIONES: { valor: ResultadoAudiencia; etiqueta: string; Icono: typeof CheckCircle2; activa: string }[] = [
  { valor: 'REALIZADA', etiqueta: 'Se realizó', Icono: CheckCircle2, activa: 'border-[#2f6b3f] bg-[#e7f1ea] text-[#2f6b3f]' },
  { valor: 'NO_REALIZADA', etiqueta: 'No se realizó', Icono: XCircle, activa: 'border-[#8a3a2c] bg-[#f3e8e6] text-[#8a3a2c]' },
]

/**
 * Registrar lo que pasó en la audiencia y, en el mismo paso, adjuntar el acta o la constancia.
 * Primero se guarda el resultado; los archivos se suben después, cada uno por su cuenta: si uno
 * falla, el resultado ya quedó y ese archivo se puede reintentar.
 */
export default function ModalResultadoAudiencia({ audiencia, onCerrar, onHecho, onConflicto }: PropsModalAudiencia) {
  const [resultado, setResultado] = useState<ResultadoAudiencia | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [motivo, setMotivo] = useState('')
  const [numeroJudicial, setNumeroJudicial] = useState('')
  const [agendarOtra, setAgendarOtra] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)
  const cola = useColaAudiencia()
  const pideNumeroJudicial = !audiencia.numeroJudicial

  function terminar() {
    const siguiente = resultado === 'NO_REALIZADA' && agendarOtra ? ({ tipo: 'AGENDAR_NUEVA_FECHA', audiencia } as const) : undefined
    onHecho('Resultado de la audiencia registrado', siguiente)
  }

  function guardar() {
    const validado = registrarResultadoAudienciaSchema.safeParse({
      resultado,
      observaciones,
      motivo,
      numeroJudicial: pideNumeroJudicial ? numeroJudicial : null,
      version: audiencia.version,
    })
    if (!validado.success) {
      setError(resultado ? (validado.error.issues[0]?.message ?? null) : 'Elija si la audiencia se realizó')
      return
    }
    void enviar(
      () => registrarResultadoAudiencia(audiencia.id, validado.data),
      () => {
        if (cola.items.some((item) => item.estado === 'pendiente')) {
          setGuardado(true)
          void cola.iniciar(audiencia.id)
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
      titulo="Registrar resultado"
      subtitulo={`${textoCaso(audiencia)} · ${formatFechaGT(audiencia.fecha)} ${audiencia.hora} · ${audiencia.responsable.nombre}`}
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
              Guardar resultado
            </Button>
          </>
        )
      }
    >
      {guardado ? (
        <p role="status" className="text-sm font-medium text-gray-900">
          Resultado guardado. {subiendo ? 'Subiendo documentos…' : 'Revise los documentos antes de cerrar.'}
        </p>
      ) : (
        <>
          <fieldset>
            <legend className="sr-only">Resultado</legend>
            <div className="grid grid-cols-2 gap-3">
              {OPCIONES.map(({ valor, etiqueta, Icono, activa }) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={resultado === valor}
                  onClick={() => {
                    setResultado(valor)
                    setError(null)
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 text-sm font-semibold ${
                    resultado === valor ? activa : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icono size={18} aria-hidden="true" />
                  {etiqueta}
                </button>
              ))}
            </div>
          </fieldset>

          {resultado === 'NO_REALIZADA' && (
            <>
              <label className={CLASE_ETIQUETA}>
                <span>¿Por qué no se realizó?</span>
                <textarea
                  rows={2}
                  maxLength={MOTIVO_AUDIENCIA_MAX}
                  value={motivo}
                  onChange={(evento) => setMotivo(evento.target.value)}
                  placeholder="Ej. No se presentó la parte demandada"
                  className={CLASE_CAMPO}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={agendarOtra} onChange={(evento) => setAgendarOtra(evento.target.checked)} />
                Agendar la nueva fecha ahora
              </label>
            </>
          )}

          <label className={CLASE_ETIQUETA}>
            <span>{resultado === 'REALIZADA' ? 'Qué ocurrió en la audiencia' : 'Observaciones (opcional)'}</span>
            <textarea
              rows={5}
              maxLength={OBSERVACIONES_AUDIENCIA_MAX}
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              className={CLASE_CAMPO}
            />
            <span className="block text-right font-normal text-gray-400 tabular-nums">
              {observaciones.length} / {OBSERVACIONES_AUDIENCIA_MAX}
            </span>
          </label>

          {pideNumeroJudicial && (
            <label className={CLASE_ETIQUETA}>
              <span>No. judicial (opcional, si ya lo tiene)</span>
              <input
                type="text"
                maxLength={NUMERO_JUDICIAL_MAX}
                value={numeroJudicial}
                onChange={(evento) => setNumeroJudicial(evento.target.value)}
                className={`${CLASE_CAMPO} font-mono`}
              />
            </label>
          )}

          <p className="text-xs font-medium text-gray-600">Documentos (acta, constancia) · opcional</p>
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
