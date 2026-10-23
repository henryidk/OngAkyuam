import { useState } from 'react'
import { ChevronDown, ChevronRight, NotebookPen, Paperclip, PenLine } from 'lucide-react'
import { hoyGT, type DocumentoProcesoDto, type EntradaBitacoraDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import DocumentosAdjuntos from '../documentos/DocumentosAdjuntos'
import ModalActualizarDocumento from '../documentos/ModalActualizarDocumento'
import { useAbrirDocumento } from '../documentos/useAbrirDocumento'
import { useContextoDetalle } from './contextoDetalle'
import { agruparBitacora, hora12DeInstante, type DiaBitacora } from './formatoBitacora'
import ModalDocumentosActuacion from './ModalDocumentosActuacion'
import TarjetaProximaAudiencia from './TarjetaProximaAudiencia'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

/** Punto sobre el riel del día: sólido para lo que hizo el equipo, hueco y pequeño para el sistema. */
function PuntoRiel({ sistema = false }: { sistema?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute rounded-full ring-4 ring-white ${
        sistema ? 'top-[9px] -left-[4px] h-[7px] w-[7px] border border-gray-400 bg-white' : 'top-[7px] -left-[5px] h-[9px] w-[9px] bg-brand-600'
      }`}
    />
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
  return (
    <li className="relative pb-6 pl-5 last:pb-1">
      <PuntoRiel />
      {/* Qué se hizo, y justo debajo cuándo y quién: se lee de corrido, sin cruzar la tarjeta. */}
      <h4 className="text-[15px] leading-6 font-semibold break-words text-gray-900">{entrada.tipo}</h4>
      <p className="text-xs text-gray-500 tabular-nums">
        {hora12DeInstante(entrada.createdAt)} · {entrada.registradoPor}
      </p>
      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed whitespace-pre-wrap break-words text-pretty text-gray-800">
        {entrada.contenido}
      </p>
      {/* Los documentos y "Adjuntar" en la misma fila: todo lo de archivos de la actuación junto. */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${entrada.documentos.length > 0 ? 'mt-3' : 'mt-2'}`}>
        <DocumentosAdjuntos documentos={entrada.documentos} onVer={onVer} onActualizar={onActualizar} />
        <button
          type="button"
          onClick={onAdjuntar}
          className="relative inline-flex items-center gap-1 rounded py-0.5 text-xs font-medium text-gray-500 hover:text-brand-700"
        >
          <Paperclip size={13} aria-hidden="true" />
          Adjuntar documento
          <span className="sr-only"> a la actuación «{entrada.tipo}»</span>
        </button>
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
    <li className="relative pb-1 pl-5">
      <PuntoRiel sistema />
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

  const dias: DiaBitacora[] = agruparBitacora(proceso.bitacora, hoyGT())

  return (
    <div className="space-y-4">
      <TarjetaProximaAudiencia proceso={proceso} abrirAudiencia={abrirAudiencia} />

      {proceso.bitacora.length === 0 ? (
        <EmptyState
          Icono={NotebookPen}
          titulo="La bitácora está vacía"
          descripcion="Registre aquí cada actuación: escritos, audiencias, notificaciones y seguimiento."
          accion={<Button onClick={abrirActuacion}>Registrar actuación</Button>}
        />
      ) : (
        <section aria-label="Bitácora del proceso" className={CLASE_TARJETA}>
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={abrirActuacion}
              className="flex w-full cursor-text items-center gap-2.5 rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-left text-sm text-gray-500 hover:border-gray-400 hover:bg-white"
            >
              <PenLine size={16} aria-hidden="true" className="shrink-0" />
              <span className="truncate">¿Qué se hizo en el proceso? Registrar una actuación…</span>
            </button>
          </div>

          <div className="space-y-6 px-4 pt-5 pb-5 sm:px-6">
            {dias.map((dia) => (
              <section key={dia.fecha} aria-label={dia.titulo}>
                <h3 className="mb-3 text-[13px] font-semibold text-gray-900">{dia.titulo}</h3>
                {/* El riel une las entradas del mismo día; cada día empieza uno nuevo. */}
                <ol className="ml-1 border-l border-gray-200">
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
