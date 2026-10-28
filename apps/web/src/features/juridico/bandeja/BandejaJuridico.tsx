import { useEffect, useRef } from 'react'
import { Inbox } from 'lucide-react'
import { useTituloPagina } from '../../../components/TituloPagina'
import EmptyState from '../../../components/ui/EmptyState'
import { listarBandeja } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import TarjetaReferencia from './TarjetaReferencia'

function titulo(total: number | null): string {
  if (total === null) return 'Referencias pendientes'
  if (total === 0) return 'Todo al día'
  return total === 1 ? '1 referencia espera atención' : `${total} referencias esperan atención`
}

/** Área de atención: solo recibe y distribuye. El registro de procesos se hace en el asistente. */
export default function BandejaJuridico() {
  useTituloPagina({ titulo: 'Área de atención' })
  const { versionNovedades } = useContextoJuridico()
  const { datos: referencias, error, recargar } = useRecurso(listarBandeja)

  // Trabajo Social refirió algo nuevo mientras la bandeja está abierta: se vuelve a pedir sin
  // desmontar lo que ya se ve. La primera versión es la de la carga inicial.
  const versionVista = useRef(versionNovedades)
  useEffect(() => {
    if (versionVista.current === versionNovedades) return
    versionVista.current = versionNovedades
    void recargar()
  }, [versionNovedades, recargar])

  return (
    <div className="mx-auto max-w-[920px] space-y-5">
      <div className="max-w-xl">
        <h2 className="text-[22px] font-semibold text-gray-900">{titulo(referencias?.length ?? null)}</h2>
        <p className="mt-1 text-sm text-gray-600">
          Al atender un caso, los procesos que abras quedan En proceso automáticamente.
        </p>
      </div>

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta bandeja" onReintentar={() => void recargar()} />
      ) : !referencias ? (
        <Esqueleto />
      ) : referencias.length === 0 ? (
        <EmptyState
          Icono={Inbox}
          titulo="No hay referencias pendientes"
          descripcion="Cuando Trabajo Social refiera una usuaria a Jurídico, aparecerá aquí."
        />
      ) : (
        <div className="space-y-3">
          {referencias.map((referencia) => (
            <TarjetaReferencia key={referencia.referidoId} referencia={referencia} />
          ))}
        </div>
      )}
    </div>
  )
}
