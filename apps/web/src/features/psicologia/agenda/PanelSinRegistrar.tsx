import { Link } from 'react-router-dom'
import { formatFechaGT, type CitaAgendaDto } from '@akyuam/shared'
import { horaDeInstante } from '../compartido/horas'
import { RUTAS_PSICOLOGIA } from '../rutas'
import CodigoProceso from '../compartido/CodigoProceso'
import { BOTON_COLA_AMBAR, BOTON_COLA_BORDE } from './estilos'
import { diaDeCita } from './semana'
import TarjetaCola, { FilaCola } from './TarjetaCola'

interface PanelSinRegistrarProps {
  /** Citas de las últimas semanas que ya pasaron sin sesión ni inasistencia, salvo las del día abierto. */
  citas: CitaAgendaDto[]
  /** Las que existen fuera del día abierto: si hay más que `citas`, son anteriores a la ventana cargada. */
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
    <TarjetaCola
      tono="ambar"
      titulo={`Citas sin registrar · ${cantidad}`}
      ayuda="Ya pasaron y no tienen sesión ni inasistencia registrada."
    >
      {citas.map((cita) => {
        const dia = diaDeCita(cita)
        return (
          <FilaCola
            key={cita.id}
            nombre={cita.persona.nombreCompleto}
            detalle={
              <button
                type="button"
                onClick={() => onVerDia(dia)}
                className="text-left hover:text-brand-700 hover:underline"
              >
                {formatFechaGT(dia)} · {horaDeInstante(cita.fechaHora)} ·{' '}
                <CodigoProceso codigo={cita.procesoCodigo} className="text-gray-600" />
              </button>
            }
          >
            <Link
              to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)}
              aria-label={`Registrar sesión de ${cita.persona.nombreCompleto}`}
              className={BOTON_COLA_AMBAR}
            >
              Registrar
            </Link>
            <button
              type="button"
              onClick={() => onNoAsistio(cita)}
              aria-label={`Marcar que ${cita.persona.nombreCompleto} no asistió`}
              className={BOTON_COLA_BORDE}
            >
              No asistió
            </button>
          </FilaCola>
        )
      })}

      {masAntiguas > 0 && (
        <p className="border-t border-gray-100 pt-2.5 text-xs text-gray-600">
          {masAntiguas === 1 ? 'Hay 1 más' : `Hay ${masAntiguas} más`} de hace más de seis semanas: retrocede en la
          agenda para {masAntiguas === 1 ? 'verla' : 'verlas'}.
        </p>
      )}
    </TarjetaCola>
  )
}
