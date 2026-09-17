import { useRef, useState } from 'react'
import {
  ETIQUETAS_ESTADO_PROCESO_JURIDICO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  formatInstanteGT,
  type DocumentoProcesoDto,
  type NotaAvanceDto,
  type PersonalDto,
  type ProcesoDetalle,
  type ProcesoResumen,
} from '@akyuam/shared'
import { ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface TarjetaProcesoProps {
  procesoInicial: ProcesoResumen
  abogadas: PersonalDto[]
  procuradoras: PersonalDto[]
}

function formatearTamanio(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TarjetaProceso({ procesoInicial, abogadas, procuradoras }: TarjetaProcesoProps) {
  const [resumen, setResumen] = useState<ProcesoResumen>(procesoInicial)
  const [detalle, setDetalle] = useState<ProcesoDetalle | null>(null)
  const [expandido, setExpandido] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)

  async function alternarExpansion() {
    setExpandido((actual) => !actual)
    if (detalle || cargandoDetalle) return
    setCargandoDetalle(true)
    setErrorDetalle(null)
    try {
      const { data } = await api.get<ProcesoDetalle>(`/juridico/procesos/${resumen.id}`)
      setDetalle(data)
    } catch (err) {
      setErrorDetalle(extraerMensajeError(err))
    } finally {
      setCargandoDetalle(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={alternarExpansion}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{ETIQUETAS_TIPO_PROCESO_JURIDICO[resumen.tipo]}</span>
          <Badge tono={resumen.estado === 'CERRADO' ? 'success' : 'neutral'}>
            {ETIQUETAS_ESTADO_PROCESO_JURIDICO[resumen.estado]}
          </Badge>
          {resumen.abandono && <Badge tono="warning">Abandonado</Badge>}
          <span className="text-xs text-gray-500">Inicio: {formatFechaGT(resumen.fechaInicio)}</span>
        </div>
        {expandido ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expandido && (
        <div className="border-t border-gray-100 px-4 py-4">
          {errorDetalle && <p className="text-sm text-red-600">{errorDetalle}</p>}
          {cargandoDetalle && <p className="text-sm text-gray-500">Cargando proceso…</p>}

          {detalle && (
            <div className="space-y-5">
              <SeccionAsignacion
                procesoId={resumen.id}
                resumen={resumen}
                abogadas={abogadas}
                procuradoras={procuradoras}
                onActualizado={(patch) => setResumen((actual) => ({ ...actual, ...patch }))}
              />

              <SeccionNotas
                procesoId={resumen.id}
                notas={detalle.notas}
                onAgregada={(nota) => setDetalle((actual) => actual && { ...actual, notas: [nota, ...actual.notas] })}
              />

              <SeccionDocumentos
                procesoId={resumen.id}
                documentos={detalle.documentos}
                onSubido={(documento) =>
                  setDetalle((actual) => actual && { ...actual, documentos: [documento, ...actual.documentos] })
                }
              />

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                {resumen.estado !== 'CERRADO' && (
                  <AccionCerrarProceso
                    procesoId={resumen.id}
                    onCerrado={(fechaCierre) => setResumen((actual) => ({ ...actual, estado: 'CERRADO', fechaCierre }))}
                  />
                )}
                {!resumen.abandono && (
                  <AccionRegistrarAbandono
                    procesoId={resumen.id}
                    onRegistrado={(abandono) => setResumen((actual) => ({ ...actual, abandono }))}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Asignación de abogada/procuradora ----

interface SeccionAsignacionProps {
  procesoId: string
  resumen: ProcesoResumen
  abogadas: PersonalDto[]
  procuradoras: PersonalDto[]
  onActualizado: (patch: Partial<ProcesoResumen>) => void
}

function SeccionAsignacion({ procesoId, resumen, abogadas, procuradoras, onActualizado }: SeccionAsignacionProps) {
  const [abogadaId, setAbogadaId] = useState(resumen.abogada?.id ?? '')
  const [procuradoraId, setProcuradoraId] = useState(resumen.procuradora?.id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await api.patch(`/juridico/procesos/${procesoId}/asignacion`, { abogadaId, procuradoraId })
      const abogada = abogadaId ? (abogadas.find((item) => item.id === abogadaId) ?? null) : null
      const procuradora = procuradoraId ? (procuradoras.find((item) => item.id === procuradoraId) ?? null) : null
      onActualizado({
        abogada: abogada ? { id: abogada.id, nombre: abogada.nombre } : null,
        procuradora: procuradora ? { id: procuradora.id, nombre: procuradora.nombre } : null,
      })
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Asignación</h4>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Abogada</span>
          <select
            value={abogadaId}
            onChange={(event) => setAbogadaId(event.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Sin asignar</option>
            {abogadas.map((abogada) => (
              <option key={abogada.id} value={abogada.id}>
                {abogada.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Procuradora</span>
          <select
            value={procuradoraId}
            onChange={(event) => setProcuradoraId(event.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Sin asignar</option>
            {procuradoras.map((procuradora) => (
              <option key={procuradora.id} value={procuradora.id}>
                {procuradora.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button variante="secondary" onClick={guardar} cargando={guardando}>
          Guardar asignación
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}

// ---- Notas de avance ----

interface SeccionNotasProps {
  procesoId: string
  notas: NotaAvanceDto[]
  onAgregada: (nota: NotaAvanceDto) => void
}

function SeccionNotas({ procesoId, notas, onAgregada }: SeccionNotasProps) {
  const [contenido, setContenido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function agregar() {
    if (!contenido.trim()) return
    setEnviando(true)
    setError(null)
    try {
      const { data } = await api.post<NotaAvanceDto>(`/juridico/procesos/${procesoId}/notas`, { contenido })
      onAgregada(data)
      setContenido('')
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Notas de avance</h4>
      {notas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin notas todavía.</p>
      ) : (
        <ul className="space-y-2">
          {notas.map((nota) => (
            <li key={nota.id} className="rounded bg-gray-50 px-3 py-2 text-sm">
              <p className="text-gray-800">{nota.contenido}</p>
              <p className="mt-1 text-xs text-gray-400">
                {nota.registradoPor} · {formatInstanteGT(nota.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <textarea
          value={contenido}
          onChange={(event) => setContenido(event.target.value)}
          rows={2}
          placeholder="Agregar una nota de avance…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button onClick={agregar} cargando={enviando} disabled={!contenido.trim()}>
          Agregar
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}

// ---- Documentos del proceso ----

interface SeccionDocumentosProps {
  procesoId: string
  documentos: DocumentoProcesoDto[]
  onSubido: (documento: DocumentoProcesoDto) => void
}

function SeccionDocumentos({ procesoId, documentos, onSubido }: SeccionDocumentosProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [nombreVisible, setNombreVisible] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descargandoId, setDescargandoId] = useState<string | null>(null)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  async function subir() {
    if (!archivo || !nombreVisible.trim()) return
    setSubiendo(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('nombreVisible', nombreVisible)
      const { data } = await api.post<DocumentoProcesoDto>(`/juridico/procesos/${procesoId}/documentos`, formData)
      onSubido(data)
      setNombreVisible('')
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setSubiendo(false)
    }
  }

  async function descargar(documentoId: string) {
    setErrorDescarga(null)
    setDescargandoId(documentoId)
    try {
      const { data } = await api.get<{ url: string }>(
        `/juridico/procesos/${procesoId}/documentos/${documentoId}/url`,
      )
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setErrorDescarga(extraerMensajeError(err))
    } finally {
      setDescargandoId(null)
    }
  }

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Documentos</h4>
      {errorDescarga && <p className="mb-2 text-sm text-red-600">{errorDescarga}</p>}

      {documentos.length === 0 ? (
        <p className="text-sm text-gray-400">Sin documentos todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documentos.map((documento) => (
            <li key={documento.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800">{documento.nombreVisible}</p>
                <p className="truncate text-xs text-gray-500">
                  {documento.nombreArchivo} · {formatearTamanio(documento.tamanioBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => descargar(documento.id)}
                disabled={descargandoId === documento.id}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                {descargandoId === documento.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Descargar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="text"
          value={nombreVisible}
          onChange={(event) => setNombreVisible(event.target.value)}
          placeholder="Nombre del documento (ej. Demanda inicial)"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={(event) => setArchivo(event.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button onClick={subir} cargando={subiendo} disabled={!archivo || !nombreVisible.trim()}>
          Subir
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}

// ---- Cerrar proceso ----

interface AccionCerrarProcesoProps {
  procesoId: string
  onCerrado: (fechaCierre: string) => void
}

function AccionCerrarProceso({ procesoId, onCerrado }: AccionCerrarProcesoProps) {
  const [abierto, setAbierto] = useState(false)
  const [fechaCierre, setFechaCierre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    if (!fechaCierre) {
      setError('Debe indicar la fecha de cierre')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await api.patch(`/juridico/procesos/${procesoId}/cierre`, { fechaCierre })
      onCerrado(fechaCierre)
      setAbierto(false)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Button variante="secondary" onClick={() => setAbierto(true)}>
        Cerrar proceso
      </Button>
      <ConfirmModal
        abierto={abierto}
        titulo="Cerrar proceso"
        descripcion="Indica la fecha de cierre. Esta acción no se puede deshacer."
        confirmarLabel="Cerrar proceso"
        cargando={guardando}
        error={error}
        onConfirmar={confirmar}
        onCancelar={() => setAbierto(false)}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-500">Fecha de cierre</span>
          <input
            type="date"
            value={fechaCierre}
            onChange={(event) => setFechaCierre(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </ConfirmModal>
    </>
  )
}

// ---- Registrar abandono ----

interface AccionRegistrarAbandonoProps {
  procesoId: string
  onRegistrado: (abandono: { fecha: string; motivo: string | null }) => void
}

function AccionRegistrarAbandono({ procesoId, onRegistrado }: AccionRegistrarAbandonoProps) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    if (!fecha) {
      setError('Debe indicar la fecha')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await api.post(`/juridico/procesos/${procesoId}/abandono`, { fecha, motivo })
      onRegistrado({ fecha, motivo: motivo.trim() ? motivo : null })
      setAbierto(false)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Button variante="danger" onClick={() => setAbierto(true)}>
        Registrar abandono
      </Button>
      <ConfirmModal
        abierto={abierto}
        titulo="Registrar abandono"
        descripcion="La usuaria abandonó este proceso. Esta acción no se puede deshacer."
        confirmarLabel="Registrar abandono"
        peligro
        cargando={guardando}
        error={error}
        onConfirmar={confirmar}
        onCancelar={() => setAbierto(false)}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-500">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-500">Motivo (opcional)</span>
          <textarea
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </ConfirmModal>
    </>
  )
}
