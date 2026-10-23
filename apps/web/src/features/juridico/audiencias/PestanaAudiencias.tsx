import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AccionAudiencia, AudienciaDetalleDto, DocumentoProcesoDto } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import { listarAudienciasProceso } from '../api/audiencias.api'
import { ErrorVista } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import { useContextoDetalle } from '../detalle/contextoDetalle'
import ModalActualizarDocumento from '../documentos/ModalActualizarDocumento'
import { useAbrirDocumento } from '../documentos/useAbrirDocumento'
import { admiteAudiencias } from './caso'
import TarjetaAudiencia from './TarjetaAudiencia'

/**
 * Pestaña Audiencias del proceso: línea de tiempo de la más reciente a la más antigua. Se agenda
 * desde la cabecera; los modales los pinta el detalle, así ambos comparten el mismo flujo.
 */
export default function PestanaAudiencias() {
  const { proceso, abrirAudiencia, versionAudiencias, refrescar } = useContextoDetalle()
  const { mostrar } = useToast()
  const [actualizar, setActualizar] = useState<DocumentoProcesoDto | null>(null)
  const [params] = useSearchParams()
  const resaltadaId = params.get('audiencia')
  const { ver } = useAbrirDocumento(proceso.id)

  const cargar = useCallback(() => listarAudienciasProceso(proceso.id), [proceso.id])
  const { datos, error, cargando, recargar } = useRecurso(cargar)

  // Tras un cambio se vuelve a pedir conservando la lista visible, sin volver al esqueleto.
  const versionVista = useRef(versionAudiencias)
  useEffect(() => {
    if (versionVista.current === versionAudiencias) return
    versionVista.current = versionAudiencias
    void recargar()
  }, [versionAudiencias, recargar])

  const onAccion = useCallback(
    (accion: AccionAudiencia, audiencia: AudienciaDetalleDto) => abrirAudiencia({ tipo: accion, audiencia }),
    [abrirAudiencia],
  )
  const puedeAgendar = admiteAudiencias(proceso)

  if (error && !datos) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las audiencias" onReintentar={() => void recargar()} />
  }

  return (
    <div className="space-y-4">
      {!datos && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((indice) => (
            <div key={indice} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {datos && datos.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          <p>Este proceso todavía no tiene audiencias.</p>
          <p className="mt-1">
            {puedeAgendar
              ? 'Use «Agendar audiencia» en la cabecera del proceso.'
              : 'El proceso está cerrado: ya no se le agendan audiencias.'}
          </p>
        </div>
      )}

      {datos && datos.length > 0 && (
        <ol aria-label="Audiencias del proceso" className={cargando ? 'opacity-60' : undefined}>
          {datos.map((audiencia) => (
            <TarjetaAudiencia
              key={audiencia.id}
              audiencia={audiencia}
              resaltada={audiencia.id === resaltadaId}
              onAccion={onAccion}
              onVerDocumento={(documento) => void ver(documento)}
              onActualizarDocumento={setActualizar}
            />
          ))}
        </ol>
      )}

      {actualizar && (
        <ModalActualizarDocumento
          procesoId={proceso.id}
          documento={actualizar}
          onCerrar={() => setActualizar(null)}
          onHecho={() => {
            setActualizar(null)
            mostrar('Documento actualizado')
            void recargar()
            refrescar()
          }}
        />
      )}
    </div>
  )
}
