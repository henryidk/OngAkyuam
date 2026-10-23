import { useState } from 'react'
import { ChevronDown, ChevronRight, NotebookPen, Plus } from 'lucide-react'
import { hoyGT, type DocumentoProcesoDto, type EntradaBitacoraDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import DocumentosAdjuntos from '../documentos/DocumentosAdjuntos'
import ModalActualizarDocumento from '../documentos/ModalActualizarDocumento'
import { useAbrirDocumento } from '../documentos/useAbrirDocumento'
import { useContextoDetalle } from './contextoDetalle'
import { agruparBitacora, hora12DeInstante, inicialTipo, type DiaBitacora } from './formatoBitacora'
import ModalDocumentosActuacion from './ModalDocumentosActuacion'
import TarjetaProximaAudiencia from './TarjetaProximaAudiencia'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

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
    <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 py-2.5">
      <span
        aria-hidden="true"
        className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#f7f3fc] text-[13px] font-bold text-[#5b3985]"
      >
        {inicialTipo(entrada.tipo)}
      </span>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <h4 className="text-[15px] font-semibold break-words text-gray-900">{entrada.tipo}</h4>
          <span className="text-xs text-gray-500 tabular-nums">
            {entrada.registradoPor} · {hora12DeInstante(entrada.createdAt)}
          </span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-pretty text-gray-800">{entrada.contenido}</p>
        {entrada.documentos.length > 0 && (
          <DocumentosAdjuntos documentos={entrada.documentos} onVer={onVer} onActualizar={onActualizar} />
        )}
        <button
          type="button"
          onClick={onAdjuntar}
          className="inline-flex items-center gap-1 rounded py-0.5 text-xs font-medium text-gray-500 hover:text-brand-700"
        >
          <Plus size={13} aria-hidden="true" />
          Adjuntar
          <span className="sr-only"> un documento a la actuación «{entrada.tipo}»</span>
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
    <div className="mt-1 ml-[46px]">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-800"
      >
        <Chevron size={13} aria-hidden="true" />
        {abierto ? `Ocultar ${cantidad}` : cantidad}
      </button>
      {abierto && (
        <ul className="mt-1">
          {entradas.map((entrada) => (
            <li key={entrada.id} className="flex justify-between gap-3 px-2.5 py-1.5 text-[13px] text-gray-600">
              <span className="min-w-0 break-words">{entrada.contenido}</span>
              <span className="shrink-0 text-gray-500 tabular-nums">{hora12DeInstante(entrada.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
              className="block w-full cursor-text truncate rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-left text-sm text-gray-500 hover:border-gray-400 hover:bg-white"
            >
              ¿Qué se hizo en el proceso? Registrar una actuación…
            </button>
          </div>

          <div className="px-4 pt-1 pb-4 sm:px-5">
            {dias.map((dia) => (
              <section key={dia.fecha} aria-label={dia.titulo}>
                <div className="flex items-center gap-2.5 pt-4 pb-1.5">
                  <h3 className="text-[13px] font-semibold text-gray-900">{dia.titulo}</h3>
                  <span aria-hidden="true" className="h-px flex-1 bg-gray-100" />
                </div>
                {dia.actuaciones.length > 0 && (
                  <ol>
                    {dia.actuaciones.map((entrada) => (
                      <Actuacion
                        key={entrada.id}
                        entrada={entrada}
                        onAdjuntar={() => setAdjuntarA(entrada)}
                        onVer={(documento) => void ver(documento)}
                        onActualizar={setActualizar}
                      />
                    ))}
                  </ol>
                )}
                {dia.sistema.length > 0 && <CambiosSistema entradas={dia.sistema} />}
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
