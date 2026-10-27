import { useMemo, useState, type ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { hoyGT, type SesionPorRegistrarDto } from '@akyuam/shared'
import EmptyState from '../../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import { useToast } from '../../../../components/ui/Toast'
import { useRecurso } from '../../../../lib/useRecurso'
import { listarSesionesPorRegistrar } from '../../api/psicologia.api'
import ConfirmarNoAsistio from '../../citas/ConfirmarNoAsistio'
import { useContextoPsicologia } from '../../compartido/contexto'
import FilaPorRegistrar from './FilaPorRegistrar'
import { agruparPorRegistrar } from './grupos'

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{titulo}</h2>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">{children}</ul>
    </section>
  )
}

/**
 * Consultas › Por registrar: solo mis sesiones, porque solo quien atendió puede registrarlas.
 * Las de hoy primero; luego las atrasadas, marcadas con texto y con acento ámbar.
 */
export default function ListaPorRegistrar() {
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoPsicologia()
  const sesiones = useRecurso(listarSesionesPorRegistrar)
  const [aMarcar, setAMarcar] = useState<SesionPorRegistrarDto | null>(null)

  const { recargar } = sesiones

  const grupos = useMemo(() => (sesiones.datos ? agruparPorRegistrar(sesiones.datos, hoyGT()) : null), [sesiones.datos])

  function alIntentarNoAsistio(marcada: boolean) {
    if (marcada) {
      setAMarcar(null)
      mostrar('Inasistencia registrada')
    }
    // También si falló: lo más probable es que otra pestaña ya la haya registrado.
    void recargar()
    recargarResumen()
  }

  if (sesiones.error) {
    return (
      <ErrorVista
        mensaje={sesiones.error.mensaje}
        sinPermiso={sesiones.error.sinPermiso}
        recurso="las sesiones por registrar"
        onReintentar={() => void recargar()}
      />
    )
  }
  if (!grupos) return <Esqueleto filas={4} />
  if (grupos.hoy.length === 0 && grupos.atrasadas.length === 0) {
    return <EmptyState Icono={CircleCheck} titulo="Todo al día" descripcion="No tienes sesiones por registrar." />
  }

  return (
    <div className="space-y-5">
      {grupos.hoy.length > 0 && (
        <Grupo titulo={`Hoy · ${grupos.hoy.length}`}>
          {grupos.hoy.map((sesion) => (
            <FilaPorRegistrar key={sesion.citaId} sesion={sesion} atraso={null} onNoAsistio={setAMarcar} />
          ))}
        </Grupo>
      )}
      {grupos.atrasadas.length > 0 && (
        <Grupo titulo={`Atrasadas · ${grupos.atrasadas.length}`}>
          {grupos.atrasadas.map(({ sesion, dias }) => (
            <FilaPorRegistrar key={sesion.citaId} sesion={sesion} atraso={dias} onNoAsistio={setAMarcar} />
          ))}
        </Grupo>
      )}

      <ConfirmarNoAsistio
        cita={aMarcar && { id: aMarcar.citaId, descripcion: `${aMarcar.persona.nombreCompleto} · ${aMarcar.procesoCodigo}` }}
        onCancelar={() => setAMarcar(null)}
        onIntento={alIntentarNoAsistio}
      />
    </div>
  )
}
