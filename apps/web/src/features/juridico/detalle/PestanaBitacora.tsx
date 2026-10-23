import { useState } from 'react'
import { NotebookPen, Paperclip } from 'lucide-react'
import { formatInstanteGT, type EntradaBitacoraDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import DocumentosAdjuntos from '../documentos/DocumentosAdjuntos'
import { useAbrirDocumento } from '../documentos/useAbrirDocumento'
import { useContextoDetalle } from './contextoDetalle'
import ModalDocumentosActuacion from './ModalDocumentosActuacion'

type Filtro = 'todo' | 'actuaciones' | 'sistema'

const FILTROS: { id: Filtro; etiqueta: string; incluye: (entrada: EntradaBitacoraDto) => boolean }[] = [
  { id: 'todo', etiqueta: 'Todo', incluye: () => true },
  { id: 'actuaciones', etiqueta: 'Actuaciones', incluye: (entrada) => !entrada.esSistema },
  { id: 'sistema', etiqueta: 'Sistema', incluye: (entrada) => entrada.esSistema },
]

export default function PestanaBitacora() {
  const { proceso, abrirActuacion, refrescar } = useContextoDetalle()
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [adjuntarA, setAdjuntarA] = useState<EntradaBitacoraDto | null>(null)
  const { ver, descargar } = useAbrirDocumento(proceso.id)
  const { mostrar } = useToast()

  if (proceso.bitacora.length === 0) {
    return (
      <EmptyState
        Icono={NotebookPen}
        titulo="La bitácora está vacía"
        descripcion="Registre aquí cada actuación: escritos, audiencias, notificaciones y seguimiento."
        accion={<Button onClick={abrirActuacion}>Registrar actuación</Button>}
      />
    )
  }

  const { incluye } = FILTROS.find((opcion) => opcion.id === filtro)!
  const entradas = proceso.bitacora.filter(incluye)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-[15px] font-semibold text-gray-900">Bitácora</h3>
        {FILTROS.map((opcion) => {
          const activo = opcion.id === filtro
          return (
            <button
              key={opcion.id}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(opcion.id)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                activo ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opcion.etiqueta}
            </button>
          )
        })}
      </div>

      {entradas.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">No hay entradas con este filtro.</p>
      ) : (
        <ol>
          {entradas.map((entrada) => (
            <li key={entrada.id} className="grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-[110px_14px_minmax(0,1fr)]">
              <p className="text-xs text-gray-500 tabular-nums sm:pb-[18px] sm:text-right">
                {formatInstanteGT(entrada.createdAt)}
              </p>
              <div aria-hidden="true" className="hidden flex-col items-center sm:flex">
                <span
                  className={`mt-[3px] h-2.5 w-2.5 rounded-full ${entrada.esSistema ? 'bg-gray-300' : 'bg-[#aa71c0]'}`}
                />
                <span className="w-px flex-1 bg-gray-200" />
              </div>
              <div className="min-w-0 pb-[18px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-px text-[11px] font-medium ${
                      entrada.esSistema ? 'bg-gray-100 text-gray-600' : 'bg-[#eee4f8] text-[#5b3985]'
                    }`}
                  >
                    {entrada.tipo}
                  </span>
                  <span className="text-xs text-gray-400">{entrada.registradoPor}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{entrada.contenido}</p>
                {entrada.documentos.length > 0 && (
                  <div className="mt-2">
                    <DocumentosAdjuntos
                      documentos={entrada.documentos}
                      onVer={(documento) => void ver(documento)}
                      onDescargar={(documento) => void descargar(documento)}
                    />
                  </div>
                )}
                {!entrada.esSistema && (
                  <button
                    type="button"
                    onClick={() => setAdjuntarA(entrada)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Paperclip size={13} aria-hidden="true" />
                    Adjuntar documento
                    <span className="sr-only"> a la actuación «{entrada.tipo}»</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
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
    </section>
  )
}
