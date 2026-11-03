import { useEffect, useMemo, useState } from 'react'
import {
  CATALOGOS_TIPO_PERSONAL,
  ETIQUETAS_PUESTO,
  usaFichaPersonal as usaFichaPersonalCompartida,
  type PersonalDto,
  type RolConLogin,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

type AreaConFichas = keyof typeof CATALOGOS_TIPO_PERSONAL

/**
 * Si la cuenta lleva ficha de personal: su área tiene catálogo de personal y, si se indica
 * el puesto, el puesto es de ese catálogo (una practicante de Jurídico no lleva ficha). Es
 * la misma regla que aplica la API (`usaFichaPersonal` de shared).
 */
export function usaFichaPersonal(
  rol: RolConLogin | '' | undefined,
  puesto?: string | null,
): rol is AreaConFichas {
  return usaFichaPersonalCompartida(rol, puesto)
}

/**
 * Fichas de personal que se pueden enlazar a una cuenta: del área, del mismo puesto (si la
 * cuenta tiene uno), activas y sin otra cuenta enlazada (la API rechaza las demás).
 * `usuarioId` deja pasar la ficha que ya tiene la propia cuenta, para mostrarla seleccionada
 * al editar aunque esté inactiva.
 */
export function useFichasPersonalLibres(
  rol: RolConLogin | '' | undefined,
  puesto: string | null | undefined,
  usuarioId?: string,
) {
  const [fichas, setFichas] = useState<PersonalDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const area = usaFichaPersonal(rol, puesto) ? rol : null

  useEffect(() => {
    if (!area) return
    let cancelado = false
    api
      .get<PersonalDto[]>('/personal', { params: { area } })
      .then(({ data }) => {
        if (!cancelado) setFichas(data)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [area])

  const opciones = useMemo(
    () =>
      fichas
        .filter((ficha) =>
          usuarioId !== undefined && ficha.usuarioId === usuarioId
            ? true
            : ficha.usuarioId === null && ficha.activo,
        )
        .filter((ficha) => !puesto || ficha.tipo === puesto)
        .map((ficha) => ({
          value: ficha.id,
          label: `${ficha.nombre} · ${ETIQUETAS_PUESTO[ficha.tipo] ?? ficha.tipo}${ficha.activo ? '' : ' (inactiva)'}`,
        })),
    [fichas, puesto, usuarioId],
  )

  return { opciones, error: area ? error : null }
}
