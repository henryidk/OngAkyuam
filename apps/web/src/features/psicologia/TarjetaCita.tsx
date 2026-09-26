import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react'
import {
  ESTADOS_CITA_PSICOLOGICA,
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_MODALIDAD_CITA,
  formatInstanteGT,
  type CitaResumen,
  type DocumentoCitaDto,
  type EstadoCitaPsicologica,
} from '@akyuam/shared'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface TarjetaCitaProps {
  citaInicial: CitaResumen
}

const TONO_ESTADO: Record<EstadoCitaPsicologica, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PROGRAMADA: 'neutral',
  ATENDIDA: 'success',
  CANCELADA: 'danger',
  NO_ASISTIO: 'warning',
}

function formatearTamanio(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TarjetaCita({ citaInicial }: TarjetaCitaProps) {
  const [cita, setCita] = useState<CitaResumen>(citaInicial)
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpandido((actual) => !actual)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{formatInstanteGT(cita.fechaHora)}</span>
          <Badge tono={TONO_ESTADO[cita.estado]}>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}</Badge>
          <span className="text-xs text-gray-500">{ETIQUETAS_MODALIDAD_CITA[cita.modalidad]}</span>
          <span className="text-xs text-gray-500">{cita.atendidoPor}</span>
        </div>
        {expandido ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expandido && (
        <div className="space-y-5 border-t border-gray-100 px-4 py-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-500">Motivo: </span>
            {cita.motivo}
          </p>
          {cita.lugar && (
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-500">Lugar: </span>
              {cita.lugar}
            </p>
          )}

          <SeccionRegistroCita cita={cita} onActualizada={setCita} />
          <SeccionDocumentoCita
            cita={cita}
            onSubido={(documento) => setCita((actual) => ({ ...actual, documento }))}
          />
        </div>
      )}
    </div>
  )
}

// ---- Registro de la cita (estado / observaciones / acuerdos) ----

interface SeccionRegistroCitaProps {
  cita: CitaResumen
  onActualizada: (cita: CitaResumen) => void
}

function SeccionRegistroCita({ cita, onActualizada }: SeccionRegistroCitaProps) {
  const [estado, setEstado] = useState(cita.estado)
  const [observaciones, setObservaciones] = useState(cita.observaciones ?? '')
  const [acuerdos, setAcuerdos] = useState(cita.acuerdos ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const { data } = await api.patch<CitaResumen>(`/psicologia/citas/${cita.id}`, {
        estado,
        observaciones,
        acuerdos,
      })
      onActualizada(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Registro de la cita</h4>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-500">Estado</span>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value as EstadoCitaPsicologica)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {ESTADOS_CITA_PSICOLOGICA.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_ESTADO_CITA_PSICOLOGICA[valor]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-500">Observaciones</span>
          <textarea
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-500">Acuerdos</span>
          <textarea
            value={acuerdos}
            onChange={(event) => setAcuerdos(event.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <Button variante="secondary" onClick={guardar} cargando={guardando}>
          Guardar registro
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}

// ---- Formato general de atención (escaneo) ----

interface SeccionDocumentoCitaProps {
  cita: CitaResumen
  onSubido: (documento: DocumentoCitaDto) => void
}

function SeccionDocumentoCita({ cita, onSubido }: SeccionDocumentoCitaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  async function subir() {
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const { data } = await api.post<DocumentoCitaDto>(`/psicologia/citas/${cita.id}/documento`, formData)
      onSubido(data)
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setSubiendo(false)
    }
  }

  async function descargar() {
    setErrorDescarga(null)
    setDescargando(true)
    try {
      const { data } = await api.get<{ url: string }>(`/psicologia/citas/${cita.id}/documento/url`)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setErrorDescarga(extraerMensajeError(err))
    } finally {
      setDescargando(false)
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Formato general de atención</h4>

      {cita.documento ? (
        <div className="flex items-center justify-between gap-3 rounded bg-gray-50 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-800">{cita.documento.nombreArchivo}</p>
            <p className="text-xs text-gray-500">{formatearTamanio(cita.documento.tamanioBytes)}</p>
          </div>
          <button
            type="button"
            onClick={descargar}
            disabled={descargando}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {descargando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Descargar
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Todavía no se ha subido el escaneo de esta cita.</p>
      )}
      {errorDescarga && <p className="mt-2 text-xs text-red-600">{errorDescarga}</p>}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={(event) => setArchivo(event.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button variante="secondary" onClick={subir} cargando={subiendo} disabled={!archivo}>
          Subir escaneo
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
