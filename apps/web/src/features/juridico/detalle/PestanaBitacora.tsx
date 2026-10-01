import { NotebookPen } from 'lucide-react'
import { ETIQUETAS_TIPO_ENTRADA_BITACORA, formatInstanteGT } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { useContextoDetalle } from './contextoDetalle'

export default function PestanaBitacora() {
  const { proceso, abrirActuacion } = useContextoDetalle()

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

  return (
    <ol className="space-y-3">
      {proceso.bitacora.map((entrada) => {
        const delSistema = entrada.tipo === 'SISTEMA'
        return (
          <li key={entrada.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  delSistema ? 'bg-gray-100 text-gray-600' : 'bg-brand-100 text-brand-700'
                }`}
              >
                {ETIQUETAS_TIPO_ENTRADA_BITACORA[entrada.tipo]}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">{formatInstanteGT(entrada.createdAt)}</span>
              <span className="text-xs text-gray-500">{entrada.registradoPor}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-800">{entrada.contenido}</p>
          </li>
        )
      })}
    </ol>
  )
}
