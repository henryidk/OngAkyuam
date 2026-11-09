import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CitaAgendaMedicaDto } from '@akyuam/shared'
import { AyudaTermino } from '../../../../components/Glosario'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import { useToast } from '../../../../components/ui/Toast'
import { useRecurso } from '../../../../lib/useRecurso'
import { listarPorRegistrar } from '../../api/medica.api'
import { useContextoMedica } from '../../compartido/contexto'
import ModalInasistencia, { type ResultadoInasistencia } from '../../compartido/ModalInasistencia'
import { useRecargaNovedades } from '../../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../../rutas'
import FilaPorRegistrar from './FilaPorRegistrar'

function Seccion({
  titulo,
  descripcion,
  ayuda,
  children,
}: {
  titulo: string
  descripcion: string
  /** Ícono (i) del glosario junto al título. */
  ayuda?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
          {ayuda}
        </div>
        <p className="text-[12.5px] text-texto-suave">{descripcion}</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-borde bg-white">{children}</div>
    </section>
  )
}

/**
 * Consultas › Por registrar: las citas de hoy que ya empezaron y las de días anteriores sin
 * registrar, de la más reciente a la más antigua (regla compartida `citaPorRegistrar`).
 */
export default function ListaPorRegistrar() {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarContadores } = useContextoMedica()
  const { datos, error, recargar } = useRecurso(listarPorRegistrar)
  useRecargaNovedades(recargar)
  const [inasistencia, setInasistencia] = useState<CitaAgendaMedicaDto | null>(null)

  function trasInasistencia({ mensaje, nuevaFecha }: ResultadoInasistencia) {
    setInasistencia(null)
    mostrar(
      mensaje,
      'success',
      nuevaFecha ? { etiqueta: 'Ver en agenda', onClick: () => navigate(RUTAS_MEDICA.agenda(nuevaFecha)) } : undefined,
    )
    void recargar()
    recargarContadores()
  }

  if (error) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las consultas por registrar" onReintentar={() => void recargar()} />
  }
  if (!datos) return <Esqueleto filas={4} />

  return (
    <div className="flex flex-col gap-5">
      <Seccion titulo={`Hoy · ${datos.hoy.length}`} descripcion="Primero la que está en curso; luego las que ya terminaron. Las que aún no empiezan están en la Agenda.">
        {datos.hoy.length === 0 ? (
          <p className="p-10 text-center text-sm text-texto-suave">No hay consultas de hoy por registrar.</p>
        ) : (
          datos.hoy.map((cita) => (
            <FilaPorRegistrar key={cita.id} cita={cita} conFecha={false} onNoAsistio={() => setInasistencia(cita)} />
          ))
        )}
      </Seccion>

      {datos.atrasadas.length > 0 && (
        <Seccion
          titulo={`Atrasadas · ${datos.totalAtrasadas}`}
          ayuda={<AyudaTermino area="medica" termino="atrasada" />}
          descripcion="De otros días, de la más reciente a la más antigua: ya pasaron y no tienen consulta ni inasistencia."
        >
          {datos.atrasadas.map((cita) => (
            <FilaPorRegistrar key={cita.id} cita={cita} conFecha onNoAsistio={() => setInasistencia(cita)} />
          ))}
          {datos.totalAtrasadas > datos.atrasadas.length && (
            <p className="px-4 py-3 text-[13px] text-texto-suave">
              Se muestran las {datos.atrasadas.length} más recientes de {datos.totalAtrasadas}. Al registrarlas o marcarlas van
              apareciendo las anteriores.
            </p>
          )}
        </Seccion>
      )}

      {inasistencia && (
        <ModalInasistencia
          cita={{ ...inasistencia, referencia: inasistencia.codigoAtencion }}
          modo="inasistencia"
          onCerrar={() => setInasistencia(null)}
          onListo={trasInasistencia}
        />
      )}
    </div>
  )
}
