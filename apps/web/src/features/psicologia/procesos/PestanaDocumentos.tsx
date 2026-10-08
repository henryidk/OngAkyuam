import { FileText, FolderOpen } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import { fechaDeInstante } from '../../../lib/formato'
import BotonVerDocumento from './BotonVerDocumento'
import { useContextoDetalle } from './contextoDetalle'
import PieSesiones from './PieSesiones'

/** Los formatos generales del proceso: salen de las mismas sesiones, no de una lista aparte. */
export default function PestanaDocumentos() {
  const { sesiones } = useContextoDetalle()

  if (sesiones.error && !sesiones.items) {
    return <ErrorVista mensaje={sesiones.error} recurso="los documentos" onReintentar={sesiones.recargar} />
  }
  if (!sesiones.items) return <Esqueleto />

  const conDocumento = sesiones.items.flatMap((sesion) => (sesion.documento ? [{ sesion, documento: sesion.documento }] : []))

  return (
    <>
      <p className="text-[13px] text-gray-500">
        Formatos generales adjuntados al registrar cada sesión. Solo tú puedes abrirlos desde aquí.
      </p>
      {conDocumento.length === 0 ? (
        <EmptyState
          Icono={FolderOpen}
          titulo={sesiones.hayMas ? 'Sin documentos en las sesiones más recientes' : 'Este proceso no tiene documentos'}
          descripcion={sesiones.hayMas ? 'Carga las sesiones anteriores para ver los suyos.' : undefined}
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          {conDocumento.map(({ sesion, documento }) => (
            <li key={documento.id} className="flex items-center gap-3 px-4 py-3">
              <FileText aria-hidden="true" className="h-4 w-4 flex-none text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{documento.nombreArchivo}</p>
                <p className="text-xs text-gray-500 tabular-nums">
                  {sesion.numero !== null ? `Sesión ${sesion.numero}` : 'Inasistencia'} · {fechaDeInstante(sesion.fechaHora)} ·{' '}
                  {formatearTamanio(documento.tamanioBytes)}
                </p>
              </div>
              <BotonVerDocumento citaId={sesion.citaId} nombreArchivo={documento.nombreArchivo} />
            </li>
          ))}
        </ul>
      )}
      <PieSesiones sesiones={sesiones} />
    </>
  )
}
