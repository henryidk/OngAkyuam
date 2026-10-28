import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CitaAgendaMedicaDto } from '@akyuam/shared'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import { useToast } from '../../../../components/ui/Toast'
import { useRecurso } from '../../../../lib/useRecurso'
import { listarPorAtender } from '../../api/medica.api'
import { useContextoMedica } from '../../compartido/contexto'
import ModalInasistencia, { type ResultadoInasistencia } from '../../compartido/ModalInasistencia'
import { useRecargaNovedades } from '../../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../../rutas'
import FilaPorAtender from './FilaPorAtender'

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold text-[#1c2430]">{titulo}</h2>
        <p className="text-[12.5px] text-[#5b6573]">{descripcion}</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">{children}</div>
    </section>
  )
}

/** Consultas › Por atender: las citas de hoy que faltan y las de días anteriores sin registrar. */
export default function ListaPorAtender() {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarContadores } = useContextoMedica()
  const { datos, error, recargar } = useRecurso(listarPorAtender)
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
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las consultas por atender" onReintentar={() => void recargar()} />
  }
  if (!datos) return <Esqueleto filas={4} />

  return (
    <div className="flex flex-col gap-5">
      <Seccion titulo={`Hoy · ${datos.hoy.length}`} descripcion="Primero la que está en curso; luego las que siguen.">
        {datos.hoy.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#5b6573]">No quedan consultas por atender hoy.</p>
        ) : (
          datos.hoy.map((cita) => (
            <FilaPorAtender key={cita.id} cita={cita} conFecha={false} onNoAsistio={() => setInasistencia(cita)} />
          ))
        )}
      </Seccion>

      {datos.atrasadas.length > 0 && (
        <Seccion
          titulo={`Atrasadas · ${datos.atrasadas.length}`}
          descripcion="De otros días: ya pasaron y no tienen consulta ni inasistencia."
        >
          {datos.atrasadas.map((cita) => (
            <FilaPorAtender key={cita.id} cita={cita} conFecha onNoAsistio={() => setInasistencia(cita)} />
          ))}
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
