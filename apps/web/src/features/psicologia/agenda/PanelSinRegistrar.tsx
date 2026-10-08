import { Link } from 'react-router-dom'
import { formatFechaGT, type CitaAgendaDto } from '@akyuam/shared'
import { horaDeInstante } from '../compartido/horas'
import { RUTAS_PSICOLOGIA } from '../rutas'
import { diaDeCita } from './semana'

interface PanelSinRegistrarProps {
  /** Citas de las últimas semanas que ya pasaron y siguen sin sesión ni inasistencia. */
  citas: CitaAgendaDto[]
  /** Las que existen en total (contador del menú): si hay más, son anteriores a la ventana cargada. */
  total: number
  onVerDia: (dia: string) => void
  onNoAsistio: (cita: CitaAgendaDto) => void
}

/** Lo atrasado: solo aparece cuando hay algo que registrar. */
export default function PanelSinRegistrar({ citas, total, onVerDia, onNoAsistio }: PanelSinRegistrarProps) {
  const cantidad = Math.max(total, citas.length)
  if (cantidad === 0) return null
  const masAntiguas = cantidad - citas.length

  return (
    <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div>
        <h2 className="text-sm font-semibold text-amber-900">Citas sin registrar · {cantidad}</h2>
        <p className="text-xs text-gray-600">Ya pasaron y no tienen sesión ni inasistencia registrada.</p>
      </div>

      <ul className="space-y-2">
        {citas.map((cita) => {
          const dia = diaDeCita(cita)
          return (
            <li key={cita.id} className="rounded-lg border border-amber-200 bg-white p-3">
              <p className="truncate text-sm font-medium text-gray-800">{cita.persona.nombreCompleto}</p>
              <button
                type="button"
                onClick={() => onVerDia(dia)}
                className="text-xs text-gray-500 tabular-nums hover:text-brand-700 hover:underline"
              >
                {formatFechaGT(dia)} · {horaDeInstante(cita.fechaHora)} ·{' '}
                <span className="font-mono">{cita.procesoCodigo}</span>
              </button>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium">
                <Link to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)} className="text-brand-700 hover:underline">
                  Registrar sesión
                </Link>
                <button type="button" onClick={() => onNoAsistio(cita)} className="text-gray-700 hover:underline">
                  Marcar no asistió
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {masAntiguas > 0 && (
        <p className="text-xs text-gray-600">
          {masAntiguas === 1 ? 'Hay 1 más' : `Hay ${masAntiguas} más`} de hace más de seis semanas: retrocede en la
          agenda para {masAntiguas === 1 ? 'verla' : 'verlas'}.
        </p>
      )}
    </section>
  )
}
