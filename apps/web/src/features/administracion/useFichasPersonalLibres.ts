import { useEffect, useMemo, useState } from 'react'
import {
  CATALOGOS_TIPO_PERSONAL,
  ETIQUETAS_PUESTO,
  type PersonalDto,
  type RolConLogin,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

type AreaConFichas = keyof typeof CATALOGOS_TIPO_PERSONAL

/** Áreas cuyas cuentas llevan ficha de personal (hoy, solo Jurídico). */
export function usaFichaPersonal(rol: RolConLogin | '' | undefined): rol is AreaConFichas {
  return !!rol && rol in CATALOGOS_TIPO_PERSONAL
}

/**
 * Fichas de personal que se pueden enlazar a una cuenta: del área, del mismo puesto (si la
 * cuenta tiene uno) y sin otra cuenta enlazada. `usuarioId` deja pasar la ficha que ya
 * tiene la propia cuenta, para mostrarla seleccionada al editar.
 */
export function useFichasPersonalLibres(
  rol: RolConLogin | '' | undefined,
  puesto: string | null | undefined,
  usuarioId?: string,
) {
  const [fichas, setFichas] = useState<PersonalDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const area = usaFichaPersonal(rol) ? rol : null

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
        .filter((ficha) => ficha.usuarioId === null || ficha.usuarioId === usuarioId)
        .filter((ficha) => !puesto || ficha.tipo === puesto)
        .map((ficha) => ({
          value: ficha.id,
          label: `${ficha.nombre} · ${ETIQUETAS_PUESTO[ficha.tipo] ?? ficha.tipo}${ficha.activo ? '' : ' (inactiva)'}`,
        })),
    [fichas, puesto, usuarioId],
  )

  return { opciones, error: area ? error : null }
}
