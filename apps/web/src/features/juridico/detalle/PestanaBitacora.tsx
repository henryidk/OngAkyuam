import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Gavel,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  Paperclip,
  PenLine,
  type LucideIcon,
} from 'lucide-react'
import { BITACORA_POR_PAGINA, hoyGT, type DocumentoProcesoDto, type EntradaBitacoraDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import Paginacion from '../compartido/Paginacion'
import DocumentosAdjuntos from '../documentos/DocumentosAdjuntos'
import ModalActualizarDocumento from '../documentos/ModalActualizarDocumento'
import { useAbrirDocumento } from '../documentos/useAbrirDocumento'
import { useContextoDetalle } from './contextoDetalle'
import {
  agruparBitacora,
  categoriaActuacion,
  hora12DeInstante,
  type CategoriaActuacion,
  type DiaBitacora,
} from './formatoBitacora'
import ModalDocumentosActuacion from './ModalDocumentosActuacion'
import TarjetaProximaAudiencia from './TarjetaProximaAudiencia'
import { useBitacoraPaginada } from './useBitacoraPaginada'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

const ICONO_CATEGORIA: Record<CategoriaActuacion, LucideIcon> = {
  resolucion: Gavel,
  escrito: FileText,
  notificacion: Mail,
  audiencia: Landmark,
  contacto: MessageCircle,
  diligencia: MapPin,
  otra: PenLine,
}

/** Hora en la columna de la izquierda (pantallas medianas en adelante), alineada con el título. */
function HoraMargen({ instante }: { instante: string }) {
  return (
    <span className="absolute top-[5px] right-full mr-7 hidden w-[4.5rem] text-right text-xs whitespace-nowrap text-gray-500 tabular-nums sm:block">
      {hora12DeInstante(instante)}
    </span>
  )
}

function Actuacion({
  entrada,
  onAdjuntar,
  onVer,
  onActualizar,
}: {
  entrada: EntradaBitacoraDto
  onAdjuntar: () => void
  onVer: (documento: DocumentoProcesoDto) => void
  onActualizar: (documento: DocumentoProcesoDto) => void
}) {
  const Icono = ICONO_CATEGORIA[categoriaActuacion(entrada.tipo)]
  return (
    <li className="relative pb-7 pl-7 last:pb-2">
      <HoraMargen instante={entrada.createdAt} />
      {/* El ícono dice de un vistazo qué clase de actuación es; el riel une las del día. */}
      <span
        aria-hidden="true"
        className="absolute top-[-2px] -left-[14px] flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-4 ring-white"
      >
        <Icono size={14} strokeWidth={2} />
      </span>
      <div className="max-w-[46rem]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-[15px] leading-6 font-semibold break-words text-gray-900">{entrada.tipo}</h4>
            <p className="text-xs text-gray-500 tabular-nums">
              <span className="sm:hidden">{hora12DeInstante(entrada.createdAt)} · </span>
              {entrada.registradoPor}
            </p>
          </div>
          {/* Acción secundaria de cada actuación: a la derecha del título, no una fila más. */}
          <button
            type="button"
            onClick={onAdjuntar}
            className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-brand-50 hover:text-brand-700"
          >
            <Paperclip size={13} aria-hidden="true" />
            Adjuntar
            <span className="sr-only"> documento al avance «{entrada.tipo}»</span>
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-pretty text-gray-800">
          {entrada.contenido}
        </p>
        {entrada.documentos.length > 0 && (
          <div className="mt-3">
            <DocumentosAdjuntos documentos={entrada.documentos} onVer={onVer} onActualizar={onActualizar} />
          </div>
        )}
      </div>
    </li>
  )
}

/** Los cambios del sistema de un día, plegados bajo un botón: se abren solo si se buscan. */
function CambiosSistema({ entradas }: { entradas: EntradaBitacoraDto[] }) {
  const [abierto, setAbierto] = useState(false)
  const Chevron = abierto ? ChevronDown : ChevronRight
  const cantidad = `${entradas.length} ${entradas.length === 1 ? 'cambio' : 'cambios'} del sistema`
  return (
    <li className="relative pb-1 pl-7">
      <span
        aria-hidden="true"
        className="absolute top-[8px] -left-[4px] h-[7px] w-[7px] rounded-full border border-gray-400 bg-white ring-4 ring-white"
      />
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="inline-flex items-center gap-1 rounded py-0.5 text-xs font-medium text-gray-500 hover:text-gray-900"
      >
        <Chevron size={13} aria-hidden="true" />
        {abierto ? `Ocultar ${cantidad}` : cantidad}
      </button>
      {abierto && (
        <ul className="mt-1 space-y-1 border-l border-gray-200 pl-3">
          {entradas.map((entrada) => (
            <li key={entrada.id} className="flex gap-3 text-[13px] text-gray-600">
              <span className="w-[68px] shrink-0 text-xs leading-5 text-gray-500 tabular-nums">
                {hora12DeInstante(entrada.createdAt)}
              </span>
              <span className="min-w-0 break-words">{entrada.contenido}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function PestanaBitacora() {
  const { proceso, abrirActuacion, abrirAudiencia, refrescar } = useContextoDetalle()
  const [adjuntarA, setAdjuntarA] = useState<EntradaBitacoraDto | null>(null)
  const [actualizar, setActualizar] = useState<DocumentoProcesoDto | null>(null)
  const { ver } = useAbrirDocumento(proceso.id)
  const { mostrar } = useToast()

  const bitacora = useBitacoraPaginada(proceso)
  const dias: DiaBitacora[] = agruparBitacora(bitacora.entradas, hoyGT())
  const desde = (bitacora.pagina - 1) * BITACORA_POR_PAGINA + 1
  const hasta = desde + bitacora.entradas.length - 1
  const seccion = useRef<HTMLElement>(null)

  function irAPagina(pagina: number) {
    bitacora.cambiarPagina(pagina)
    // La paginación está al pie: al cambiar de página se vuelve al inicio de la bitácora.
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    seccion.current?.scrollIntoView({ block: 'start', behavior: sinMovimiento ? 'auto' : 'smooth' })
  }

  return (
    <div className="space-y-4">
      <TarjetaProximaAudiencia proceso={proceso} abrirAudiencia={abrirAudiencia} />

      {proceso.bitacora.length === 0 ? (
        <EmptyState
          Icono={NotebookPen}
          titulo="La bitácora está vacía"
          descripcion="Registre aquí cada avance: escritos, audiencias, notificaciones y seguimiento."
          accion={<Button onClick={abrirActuacion}>Registrar avance</Button>}
        />
      ) : (
        <section ref={seccion} aria-label="Bitácora del proceso" className={`${CLASE_TARJETA} scroll-mt-4`}>
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={abrirActuacion}
              className="flex w-full cursor-text items-center gap-2.5 rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-left text-sm text-gray-500 hover:border-gray-400 hover:bg-white"
            >
              <PenLine size={16} aria-hidden="true" className="shrink-0" />
              <span className="truncate">¿Qué se hizo en el proceso? Registrar un avance…</span>
            </button>
          </div>

          <div
            aria-busy={bitacora.cargando}
            className={`space-y-7 px-4 pt-6 pb-6 transition-opacity sm:px-6 ${bitacora.cargando ? 'opacity-50' : ''}`}
          >
            {dias.map((dia) => (
              <section key={dia.fecha} aria-label={dia.titulo}>
                {/* La fecha cruza la tarjeta con una línea fina: separa los días sin competir con las actuaciones. */}
                <h3 className="mb-4 flex items-center gap-3 text-[13px] font-semibold text-gray-900">
                  <span className="shrink-0">{dia.titulo}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-gray-200/70" />
                </h3>
                {/* El riel une las entradas del mismo día; a su izquierda, la columna de horas. */}
                <ol className="ml-[14px] border-l border-gray-200 sm:ml-[7.25rem]">
                  {dia.actuaciones.map((entrada) => (
                    <Actuacion
                      key={entrada.id}
                      entrada={entrada}
                      onAdjuntar={() => setAdjuntarA(entrada)}
                      onVer={(documento) => void ver(documento)}
                      onActualizar={setActualizar}
                    />
                  ))}
                  {dia.sistema.length > 0 && <CambiosSistema entradas={dia.sistema} />}
                </ol>
              </section>
            ))}
          </div>

          {/* Páginas fijas: cambiar de página reemplaza lo que se ve, la pantalla no se alarga.
              El rango dice dónde se está, así nadie cree que la bitácora empieza aquí. */}
          {bitacora.total > BITACORA_POR_PAGINA && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 text-sm sm:px-6">
              <p className="text-xs text-gray-500 tabular-nums" aria-live="polite">
                {bitacora.error ? (
                  <span className="text-red-700">
                    No se pudo cargar la página.{' '}
                    <button type="button" onClick={bitacora.reintentar} className="font-medium underline">
                      Reintentar
                    </button>
                  </span>
                ) : (
                  <>
                    Entradas {desde}–{hasta} de {bitacora.total}
                  </>
                )}
              </p>
              <Paginacion
                etiqueta="Paginación de la bitácora"
                pagina={bitacora.pagina}
                pageSize={BITACORA_POR_PAGINA}
                total={bitacora.total}
                onCambiar={irAPagina}
              />
            </div>
          )}
        </section>
      )}

      {adjuntarA && (
        <ModalDocumentosActuacion
          procesoId={proceso.id}
          actuacion={adjuntarA}
          onCerrar={() => setAdjuntarA(null)}
          onHecho={(mensaje) => {
            setAdjuntarA(null)
            mostrar(mensaje)
            refrescar()
          }}
        />
      )}
      {actualizar && (
        <ModalActualizarDocumento
          procesoId={proceso.id}
          documento={actualizar}
          onCerrar={() => setActualizar(null)}
          onHecho={() => {
            setActualizar(null)
            mostrar('Documento actualizado')
            refrescar()
          }}
        />
      )}
    </div>
  )
}
