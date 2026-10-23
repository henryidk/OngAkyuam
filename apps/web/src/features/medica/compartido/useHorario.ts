import axios from 'axios'
import { useCallback, useMemo, useState } from 'react'
import { DIAS_DISPONIBILIDAD, hoyGT, sugerirHorario } from '@akyuam/shared'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerDisponibilidad } from '../api/medica.api'

export const MENSAJE_HORARIO_TOMADO = 'Alguien tomó ese horario; elige otro.'

/**
 * `true` si el servidor rechazó la hora porque ya estaba ocupada (alguien la tomó mientras el
 * modal estaba abierto). Otros 409 (versión vieja, referencia ya atendida) traen su propio mensaje.
 */
export function esConflictoHorario(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return false
  return (err.response.data as { codigo?: string } | undefined)?.codigo === 'HORARIO_OCUPADO'
}

/**
 * Disponibilidad de los próximos días hábiles y el día y hora elegidos. Al llegar la
 * disponibilidad se propone el primer hueco (respetando `preferido`); si después se recarga
 * (por un conflicto), se conserva el día y se vuelve a proponer una hora libre.
 */
export function useHorario(preferido: { fecha?: string | null; hora?: string | null; despuesDe?: string | null } = {}) {
  const { datos: disponibilidad, error, recargar } = useRecurso(
    useCallback(() => obtenerDisponibilidad(hoyGT(), DIAS_DISPONIBILIDAD), []),
  )
  // Lo que la persona eligió a mano; `null` mientras no toque nada.
  const [eleccion, setEleccion] = useState<{ fecha: string; hora: string | null } | null>(null)
  const { fecha: fechaPreferida, hora: horaPreferida, despuesDe } = preferido

  // La elección se valida contra la disponibilidad en cada render: si llega una nueva (por un
  // conflicto) y la hora ya no está libre, se propone otra del mismo día; si el día ya no
  // aplica, se vuelve a la sugerencia.
  const efectiva = useMemo(() => {
    if (!disponibilidad) return { fecha: null, hora: null }
    const dia = eleccion && disponibilidad.find((uno) => uno.fecha === eleccion.fecha && (!despuesDe || uno.fecha > despuesDe))
    if (eleccion && dia) {
      const hora = eleccion.hora && dia.libres.includes(eleccion.hora) ? eleccion.hora : (dia.libres[0] ?? null)
      return { fecha: dia.fecha, hora }
    }
    const sugerido = sugerirHorario(disponibilidad, { fecha: fechaPreferida, hora: horaPreferida, despuesDe })
    return { fecha: sugerido?.fecha ?? null, hora: sugerido?.hora ?? null }
  }, [disponibilidad, eleccion, fechaPreferida, horaPreferida, despuesDe])
  const { fecha, hora } = efectiva

  const elegirFecha = useCallback(
    (nueva: string) => {
      const dia = disponibilidad?.find((uno) => uno.fecha === nueva)
      setEleccion({ fecha: nueva, hora: hora && dia?.libres.includes(hora) ? hora : (dia?.libres[0] ?? null) })
    },
    [disponibilidad, hora],
  )

  const elegirHora = useCallback(
    (nueva: string) => {
      if (fecha) setEleccion({ fecha, hora: nueva })
    },
    [fecha],
  )

  const visibles = disponibilidad?.filter((dia) => !despuesDe || dia.fecha > despuesDe) ?? null

  return { disponibilidad: visibles, error, recargar, fecha, hora, elegirFecha, elegirHora }
}
