import { useEffect, useMemo, useState } from 'react'
import type { PersonalDto } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarPersonalJuridico } from '../api/juridico.api'

/** Abogadas y procuradoras activas, para los selects de asignación. */
export function usePersonalJuridico() {
  const [personal, setPersonal] = useState<PersonalDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    listarPersonalJuridico()
      .then((lista) => {
        if (!cancelado) setPersonal(lista)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [])

  return useMemo(() => {
    const activas = personal?.filter((persona) => persona.activo) ?? []
    return {
      abogadas: activas.filter((persona) => persona.tipo === 'ABOGADA'),
      procuradoras: activas.filter((persona) => persona.tipo === 'PROCURADORA'),
      cargando: personal === null && error === null,
      error,
    }
  }, [personal, error])
}
