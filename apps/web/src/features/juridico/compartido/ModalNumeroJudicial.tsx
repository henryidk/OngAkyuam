import { useState } from 'react'
import axios from 'axios'
import { AlertTriangle } from 'lucide-react'
import {
  NUMERO_JUDICIAL_MAX,
  asignarNumeroJudicialSchema,
  type ErrorNumeroJudicialRepetido,
  type ProcesoResumen,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { asignarNumeroJudicial } from '../api/audiencias.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from './campos'
import { esConflicto } from '../detalle/contextoDetalle'

/** El 409 de número repetido trae su propio mensaje; cualquier otro 409 es una versión vieja. */
function avisoRepetido(error: unknown): string | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const cuerpo = error.response.data as Partial<ErrorNumeroJudicialRepetido> | undefined
  return cuerpo?.codigo === 'NUMERO_JUDICIAL_REPETIDO' ? (cuerpo.message ?? 'Otro proceso ya usa este número.') : null
}

interface ModalNumeroJudicialProps {
  /** Sirve igual la fila de la lista que el detalle del proceso. */
  proceso: Pick<ProcesoResumen, 'id' | 'codigo' | 'version' | 'numeroJudicial' | 'usuaria'>
  onCerrar: () => void
  onHecho: (mensaje: string) => void
  /** Otra persona cambió el proceso: la lista se vuelve a pedir. */
  onConflicto: () => void
}

/**
 * La única vía para agregar o corregir el No. judicial, desde la lista o desde el detalle. No es único (una ejecución va en el mismo expediente
 * judicial que la fijación), así que uno repetido se avisa y se guarda solo si se confirma.
 */
export default function ModalNumeroJudicial({ proceso, onCerrar, onHecho, onConflicto }: ModalNumeroJudicialProps) {
  const actual = proceso.numeroJudicial
  const [numero, setNumero] = useState(actual ?? '')
  const [repetido, setRepetido] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    const validado = asignarNumeroJudicialSchema.safeParse({
      numeroJudicial: numero,
      version: proceso.version,
      confirmarNumeroRepetido: repetido !== null,
    })
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Revise el número')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await asignarNumeroJudicial(proceso.id, validado.data)
      onHecho(actual ? 'No. judicial corregido' : 'No. judicial guardado')
    } catch (err) {
      const aviso = avisoRepetido(err)
      if (aviso) {
        setRepetido(aviso)
      } else {
        setError(extraerMensajeError(err))
        if (esConflicto(err)) onConflicto()
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ConfirmModal
      abierto
      titulo={actual ? 'Corregir No. judicial' : 'Agregar No. judicial'}
      descripcion={`${proceso.usuaria.nombreCompleto} · ${proceso.codigo}`}
      confirmarLabel={repetido ? 'Guardar de todos modos' : 'Guardar'}
      confirmarDeshabilitado={numero.trim().length === 0 || numero.trim() === actual}
      cargando={enviando}
      error={error}
      onConfirmar={() => void guardar()}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>No. de expediente judicial</span>
        <textarea
          autoFocus
          rows={3}
          maxLength={NUMERO_JUDICIAL_MAX}
          value={numero}
          onChange={(evento) => {
            setNumero(evento.target.value)
            // Otro número: el aviso del anterior ya no aplica.
            setRepetido(null)
            setError(null)
          }}
          placeholder="Ej. Juzgado de Paz Civil, Familia y Trabajo de Cobán 16033-2025-00927"
          className={`${CLASE_CAMPO} resize-none`}
        />
        <span className="block text-right font-normal text-gray-400 tabular-nums">
          {numero.length} / {NUMERO_JUDICIAL_MAX}
        </span>
      </label>
      <p className="text-xs text-gray-500">
        {actual
          ? 'La corrección queda anotada en la bitácora del proceso.'
          : 'Es el número que el juzgado le dio al expediente. Queda anotado en la bitácora del proceso.'}
      </p>
      {repetido && (
        <div role="alert" className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{repetido}</p>
            <p className="mt-0.5">
              Puede ser correcto (por ejemplo, una ejecución va en el mismo expediente judicial que la fijación). Revise el
              número y, si está bien, guárdelo de todos modos.
            </p>
          </div>
        </div>
      )}
    </ConfirmModal>
  )
}
