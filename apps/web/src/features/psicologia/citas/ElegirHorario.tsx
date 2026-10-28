import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  hoyGT,
  type DisponibilidadDiaDto,
  type DuracionCitaPsicologica,
} from '@akyuam/shared'
import SelectorDuracion from '../../../components/agenda/SelectorDuracion'
import SelectorHorario from '../../../components/agenda/SelectorHorario'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'
import { obtenerDisponibilidad } from '../api/psicologia.api'

export interface HorarioElegido {
  /** `YYYY-MM-DD`; vacío mientras no hay día. */
  fecha: string
  /** "HH:mm"; vacío mientras no hay hora. */
  hora: string
}

interface ElegirHorarioProps extends HorarioElegido {
  duracion: DuracionCitaPsicologica
  onDuracion: (duracion: DuracionCitaPsicologica) => void
  onCambio: (horario: HorarioElegido) => void
}

/** La hora pedida si está libre ese día; si no, la siguiente libre, o la primera del día. */
function horaDelDia(dia: DisponibilidadDiaDto, hora: string): string {
  if (dia.libres.includes(hora)) return hora
  return dia.libres.find((libre) => libre >= hora) ?? dia.libres[0] ?? ''
}

/** El primer día con espacio a partir de `fecha` (fin de semana o día lleno → el siguiente). */
function primerEspacio(disponibilidad: DisponibilidadDiaDto[], { fecha, hora }: HorarioElegido): HorarioElegido | null {
  const dia = disponibilidad.find((uno) => uno.libres.length > 0 && (!fecha || uno.fecha >= fecha))
  return dia ? { fecha: dia.fecha, hora: horaDelDia(dia, hora) } : null
}

/**
 * Día, hora y duración de una cita. Muestra la semana con las horas libres de la propia agenda
 * (lo que reutiliza de "Programar consulta" de Médica) y, como el horario de Psicología no se
 * valida, deja escribir cualquier fecha y hora con "Otra fecha u hora". La fecha y hora que llegan
 * sirven de preferencia: si no están libres se propone la siguiente que sí.
 */
export default function ElegirHorario({ fecha, hora, duracion, onDuracion, onCambio }: ElegirHorarioProps) {
  const [manual, setManual] = useState(false)
  const { datos: disponibilidad, error, recargar } = useRecurso(
    useCallback(() => obtenerDisponibilidad(hoyGT(), duracion), [duracion]),
  )
  // `onCambio` suele ser una función nueva en cada render: se lee por ref.
  const avisar = useRef(onCambio)
  useEffect(() => {
    avisar.current = onCambio
  }, [onCambio])
  const ultimaDisponibilidad = useRef<DisponibilidadDiaDto[] | null>(null)

  // Cada vez que llega disponibilidad (al abrir o al cambiar la duración) se propone el primer
  // espacio desde la fecha pedida. Con la misma disponibilidad, un día lleno elegido a mano se
  // respeta (la rejilla lo muestra como "Lleno"); solo se corrige la hora si ya no está libre.
  useEffect(() => {
    if (!disponibilidad || manual) return
    const nueva = ultimaDisponibilidad.current !== disponibilidad
    ultimaDisponibilidad.current = disponibilidad
    const dia = disponibilidad.find((uno) => uno.fecha === fecha)
    const destino =
      dia && (!nueva || dia.libres.length > 0)
        ? { fecha, hora: horaDelDia(dia, hora) }
        : primerEspacio(disponibilidad, { fecha, hora })
    if (!destino) {
      // Nada libre desde esa fecha (o queda más allá de las semanas que se ofrecen): a mano.
      setManual(true)
      return
    }
    if (destino.fecha !== fecha || destino.hora !== hora) avisar.current(destino)
  }, [disponibilidad, manual, fecha, hora])

  function elegirFecha(nueva: string) {
    const dia = disponibilidad?.find((uno) => uno.fecha === nueva)
    onCambio({ fecha: nueva, hora: dia ? horaDelDia(dia, hora) : '' })
  }

  function alternarModo() {
    if (!manual) {
      setManual(true)
      return
    }
    // Una fecha escrita a mano fuera de las semanas que se ofrecen no sirve de preferencia.
    if (!disponibilidad?.some((uno) => uno.fecha === fecha)) onCambio({ fecha: '', hora })
    setManual(false)
  }

  return (
    <div className="space-y-4">
      <SelectorDuracion opciones={DURACIONES_CITA_PSICOLOGICA_MINUTOS} duracion={duracion} onCambiar={onDuracion} />

      {manual ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <label className={CLASE_ETIQUETA}>
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(evento) => onCambio({ fecha: evento.target.value, hora })}
                className={CLASE_CAMPO}
              />
            </label>
            <label className={CLASE_ETIQUETA}>
              Hora
              <input
                type="time"
                value={hora}
                onChange={(evento) => onCambio({ fecha, hora: evento.target.value })}
                className={CLASE_CAMPO}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Puede ser fuera del horario habitual. Si choca con otra de tus citas, se te avisa antes de guardar.
          </p>
        </div>
      ) : error ? (
        <ErrorVista mensaje={error.mensaje} recurso="tu agenda" onReintentar={() => void recargar()} />
      ) : !disponibilidad ? (
        <Esqueleto filas={2} />
      ) : (
        <SelectorHorario
          disponibilidad={disponibilidad}
          fecha={fecha || null}
          hora={hora || null}
          onFecha={elegirFecha}
          onHora={(nueva) => onCambio({ fecha, hora: nueva })}
        />
      )}

      <button
        type="button"
        onClick={alternarModo}
        className="text-sm font-medium text-brand-700 hover:underline"
      >
        {manual ? 'Ver horas libres de mi agenda' : 'Otra fecha u hora…'}
      </button>
    </div>
  )
}
