import { useMemo, useState, type ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { MAX_SESIONES_POR_REGISTRAR_PSICOLOGIA, hoyGT, type SesionPorRegistrarDto } from '@akyuam/shared'
import { AyudaTermino } from '../../../../components/Glosario'
import EmptyState from '../../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import { useToast } from '../../../../components/ui/Toast'
import { useRecurso } from '../../../../lib/useRecurso'
import { listarSesionesPorRegistrar } from '../../api/psicologia.api'
import ConfirmarNoAsistio from '../../citas/ConfirmarNoAsistio'
import { useContextoPsicologia } from '../../compartido/contexto'
import FilaPorRegistrar from './FilaPorRegistrar'
import { agruparPorRegistrar } from './grupos'

function Grupo({ titulo, ayuda, children }: { titulo: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <div className="flex items-center gap-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{titulo}</h2>
        {ayuda}
      </div>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">{children}</ul>
    </section>
  )
}

/** La lista trae como mucho MAX_SESIONES_POR_REGISTRAR_PSICOLOGIA; el resumen cuenta todas. */
function AvisoRecorte({ vistas, total }: { vistas: number; total: number }) {
  if (vistas < MAX_SESIONES_POR_REGISTRAR_PSICOLOGIA || total <= vistas) return null
  return (
    <p className="rounded-lg border border-borde bg-white px-4 py-3 text-[13px] text-texto-suave">
      Se muestran las {vistas} más recientes de {total}. Al registrarlas o marcarlas van apareciendo las anteriores.
    </p>
  )
}

/**
 * Consultas › Por registrar: solo mis sesiones, porque solo quien atendió puede registrarlas.
 * Las de hoy primero; luego las atrasadas, marcadas con texto y con acento ámbar.
 */
export default function ListaPorRegistrar() {
  const { mostrar } = useToast()
  const { recargarResumen, resumen } = useContextoPsicologia()
  const sesiones = useRecurso(listarSesionesPorRegistrar)
  const [aMarcar, setAMarcar] = useState<SesionPorRegistrarDto | null>(null)

  const { recargar } = sesiones

  const grupos = useMemo(() => (sesiones.datos ? agruparPorRegistrar(sesiones.datos, hoyGT()) : null), [sesiones.datos])

  function alIntentarNoAsistio(resultado: { mensaje: string } | null) {
    if (resultado) {
      setAMarcar(null)
      mostrar(resultado.mensaje)
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
        <Grupo titulo={`Atrasadas · ${grupos.atrasadas.length}`} ayuda={<AyudaTermino area="psicologia" termino="atrasada" />}>
          {grupos.atrasadas.map(({ sesion, dias }) => (
            <FilaPorRegistrar key={sesion.citaId} sesion={sesion} atraso={dias} onNoAsistio={setAMarcar} />
          ))}
        </Grupo>
      )}
      <AvisoRecorte vistas={sesiones.datos?.length ?? 0} total={resumen?.sesionesPorRegistrar ?? 0} />

      <ConfirmarNoAsistio
        cita={
          aMarcar && {
            id: aMarcar.citaId,
            descripcion: `${aMarcar.persona.nombreCompleto} · ${aMarcar.codigoProceso}`,
            fechaHora: aMarcar.fechaHora,
            duracionMinutos: aMarcar.duracionMinutos,
          }
        }
        onCancelar={() => setAMarcar(null)}
        onIntento={alIntentarNoAsistio}
      />
    </div>
  )
}
