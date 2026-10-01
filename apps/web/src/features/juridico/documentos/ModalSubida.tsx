import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import {
  CARPETA_DOCUMENTOS_GENERALES,
  NOMBRE_CARPETA_MAX,
  NOMBRE_DOCUMENTO_MAX,
  normalizarNombreCarpeta,
  type CarpetaDto,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { useDialogoModal } from '../../../components/ui/useDialogoModal'
import { ACCEPT_DOCUMENTOS, formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { crearCarpeta } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { useColaSubida, type ItemCola } from './useColaSubida'

interface ModalSubidaProps {
  procesoId: string
  carpetas: CarpetaDto[]
  /** Carpetas sugeridas para el tipo de proceso que todavía no existen. */
  sugeridas: string[]
  carpetaInicialId?: string
  archivosIniciales?: File[]
  /** `huboCambios`: se subió algo o se creó una carpeta, hay que refrescar el proceso. */
  onCerrar: (huboCambios: boolean) => void
}

const PREFIJO_EXISTENTE = 'id:'
const PREFIJO_SUGERIDA = 'nueva:'
const OTRA = 'otra'

function destinoPorDefecto(carpetas: CarpetaDto[], carpetaInicialId?: string): string {
  if (carpetaInicialId) return PREFIJO_EXISTENTE + carpetaInicialId
  const generales = carpetas.find(
    (carpeta) => normalizarNombreCarpeta(carpeta.nombre) === normalizarNombreCarpeta(CARPETA_DOCUMENTOS_GENERALES),
  )
  return generales ? PREFIJO_EXISTENTE + generales.id : PREFIJO_SUGERIDA + CARPETA_DOCUMENTOS_GENERALES
}

function FilaArchivo({
  item,
  editable,
  onRenombrar,
  onQuitar,
  onReintentar,
}: {
  item: ItemCola
  editable: boolean
  onRenombrar: (nombre: string) => void
  onQuitar: () => void
  onReintentar: (() => void) | null
}) {
  return (
    <li className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {editable && !item.invalido ? (
            <input
              type="text"
              aria-label={`Nombre para ${item.archivo.name}`}
              value={item.nombreVisible}
              maxLength={NOMBRE_DOCUMENTO_MAX}
              onChange={(evento) => onRenombrar(evento.target.value)}
              className={CLASE_CAMPO}
            />
          ) : (
            <p className="truncate text-sm font-medium text-gray-900">{item.nombreVisible || item.archivo.name}</p>
          )}
          <p className="truncate text-xs text-gray-500">
            {item.archivo.name} · {formatearTamanio(item.archivo.size)}
          </p>
          {item.estado === 'subiendo' && (
            <div
              role="progressbar"
              aria-label={`Subiendo ${item.archivo.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.progreso}
              className="h-1.5 overflow-hidden rounded-full bg-gray-200"
            >
              <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${item.progreso}%` }} />
            </div>
          )}
          {item.error && <p className="text-xs text-red-700">{item.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 text-xs">
          {item.estado === 'listo' && (
            <span className="inline-flex items-center gap-1 font-medium text-green-700">
              <CheckCircle2 size={14} /> Subido
            </span>
          )}
          {item.estado === 'error' && !editable && (
            <span className="inline-flex items-center gap-1 font-medium text-red-700">
              <XCircle size={14} /> No se subió
            </span>
          )}
          {onReintentar && (
            <button type="button" onClick={onReintentar} className="font-medium text-brand-700 hover:underline">
              Reintentar
            </button>
          )}
          {editable && (
            <button type="button" onClick={onQuitar} className="font-medium text-gray-500 hover:text-red-700 hover:underline">
              Quitar
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

/** Subida en tres momentos: preparar (elegir carpeta y nombres) → subiendo → resultado. */
export default function ModalSubida({
  procesoId,
  carpetas,
  sugeridas,
  carpetaInicialId,
  archivosIniciales,
  onCerrar,
}: ModalSubidaProps) {
  const cola = useColaSubida(procesoId)
  const { agregar } = cola
  const [destino, setDestino] = useState(() => destinoPorDefecto(carpetas, carpetaInicialId))
  const [nombreOtra, setNombreOtra] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preparando, setPreparando] = useState(false)
  const carpetaCreada = useRef(false)
  const selector = useRef<HTMLInputElement>(null)

  // Archivos que llegaron arrastrados a la pestaña: entran a la cola una sola vez al abrir.
  const iniciales = useRef(archivosIniciales)
  useEffect(() => {
    if (iniciales.current?.length) agregar(iniciales.current)
    iniciales.current = undefined
  }, [agregar])

  const subiendo = cola.fase === 'subiendo' || preparando
  const subidos = cola.items.filter((item) => item.estado === 'listo').length
  const fallidos = cola.items.filter((item) => item.estado === 'error').length
  const pendientes = cola.items.filter((item) => item.estado === 'pendiente').length

  function cerrar() {
    if (subiendo) return
    onCerrar(subidos > 0 || carpetaCreada.current)
  }
  const panel = useDialogoModal<HTMLDivElement>(true, cerrar)

  async function resolverCarpeta(): Promise<string | null> {
    if (destino.startsWith(PREFIJO_EXISTENTE)) return destino.slice(PREFIJO_EXISTENTE.length)
    const nombre = destino === OTRA ? nombreOtra.trim() : destino.slice(PREFIJO_SUGERIDA.length)
    if (!nombre) {
      setError('Escriba el nombre de la carpeta nueva')
      return null
    }
    const existente = carpetas.find(
      (carpeta) => normalizarNombreCarpeta(carpeta.nombre) === normalizarNombreCarpeta(nombre),
    )
    if (existente) return existente.id
    const creada = await crearCarpeta(procesoId, nombre)
    carpetaCreada.current = true
    // Un reintento posterior ya apunta a la carpeta creada, no intenta crearla de nuevo.
    setDestino(PREFIJO_EXISTENTE + creada.id)
    return creada.id
  }

  async function subir() {
    setError(null)
    setPreparando(true)
    try {
      const carpetaId = await resolverCarpeta()
      if (carpetaId) await cola.iniciar(carpetaId)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setPreparando(false)
    }
  }

  const enEdicion = cola.fase === 'edicion'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/50" onClick={cerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-subida"
        tabIndex={-1}
        className="relative w-full max-w-[600px] rounded-xl bg-white shadow-2xl outline-none"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="titulo-modal-subida" className="text-lg font-semibold text-gray-900">
            Subir documentos
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">PDF, JPG, PNG o WEBP · máximo 15 MB por archivo.</p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {enEdicion && (
            <>
              <label className={CLASE_ETIQUETA}>
                <span>Carpeta de destino</span>
                <select value={destino} onChange={(evento) => setDestino(evento.target.value)} className={CLASE_CAMPO}>
                  {carpetas.length > 0 && (
                    <optgroup label="Carpetas del proceso">
                      {carpetas.map((carpeta) => (
                        <option key={carpeta.id} value={PREFIJO_EXISTENTE + carpeta.id}>
                          {carpeta.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {sugeridas.length > 0 && (
                    <optgroup label="Sugeridas (se crean al subir)">
                      {sugeridas.map((nombre) => (
                        <option key={nombre} value={PREFIJO_SUGERIDA + nombre}>
                          {nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value={OTRA}>Otra carpeta nueva…</option>
                </select>
              </label>
              {destino === OTRA && (
                <label className={CLASE_ETIQUETA}>
                  <span>Nombre de la carpeta nueva</span>
                  <input
                    type="text"
                    value={nombreOtra}
                    maxLength={NOMBRE_CARPETA_MAX}
                    onChange={(evento) => setNombreOtra(evento.target.value)}
                    className={CLASE_CAMPO}
                  />
                </label>
              )}
            </>
          )}

          {cola.fase === 'resultado' && (
            <p role="status" className="text-sm font-medium text-gray-900">
              {subidos} {subidos === 1 ? 'documento subido' : 'documentos subidos'}
              {fallidos > 0 && ` · ${fallidos} sin subir`}
            </p>
          )}

          {cola.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
              Aún no ha elegido archivos.
            </p>
          ) : (
            <ul className="max-h-[320px] space-y-2 overflow-y-auto">
              {cola.items.map((item) => (
                <FilaArchivo
                  key={item.id}
                  item={item}
                  editable={enEdicion}
                  onRenombrar={(nombre) => cola.renombrar(item.id, nombre)}
                  onQuitar={() => cola.quitar(item.id)}
                  onReintentar={
                    cola.fase === 'resultado' && item.estado === 'error' && !item.invalido
                      ? () => void cola.reintentar(item.id)
                      : null
                  }
                />
              ))}
            </ul>
          )}

          {enEdicion && (
            <>
              <input
                ref={selector}
                type="file"
                multiple
                accept={ACCEPT_DOCUMENTOS}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(evento) => {
                  agregar(Array.from(evento.target.files ?? []))
                  evento.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => selector.current?.click()}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                + Agregar archivos
              </button>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50/50 px-6 py-4">
          {enEdicion && (
            <>
              <Button variante="secondary" tamano="md" onClick={cerrar} disabled={preparando}>
                Cancelar
              </Button>
              <Button tamano="md" onClick={() => void subir()} cargando={preparando} disabled={pendientes === 0}>
                {pendientes <= 1 ? 'Subir documento' : `Subir ${pendientes} documentos`}
              </Button>
            </>
          )}
          {cola.fase === 'subiendo' && (
            <Button variante="secondary" tamano="md" onClick={cola.cancelar}>
              Cancelar subida
            </Button>
          )}
          {cola.fase === 'resultado' && (
            <Button tamano="md" onClick={cerrar}>
              Listo
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
