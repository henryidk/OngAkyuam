import { useState } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import {
  editarIdentidadUsuariaSchema,
  type EditarIdentidadUsuariaInput,
  type UsuariaExpedienteHub,
} from '@akyuam/shared'
import { api } from '../../../lib/api'
import { extraerMensajeError } from '../../../lib/errors'
import { camposVisiblesModificados, valoresIdentidad, type CampoVisibleIdentidad } from './mapearDepartamento'

const HTTP_CONFLICTO = 409

export interface FormularioIdentidad {
  form: UseFormReturn<EditarIdentidadUsuariaInput>
  camposModificados: CampoVisibleIdentidad[]
  /** El DPI evita expedientes duplicados: cambiarlo pide una confirmación aparte. */
  dpiModificado: boolean
  esValido: boolean
  /** Valida y envía el PATCH; no hace nada si el formulario no es válido. */
  guardar: () => Promise<void>
  /** Vuelve a los datos guardados de la usuaria. */
  descartar: () => void
  errorEnvio: string | null
  enviando: boolean
}

/**
 * Estado y envío de la edición de identidad, sin nada de presentación: lo consume tanto la
 * ficha como el wizard. El PATCH es inmediato e independiente del submit de un caso.
 */
export function useFormularioIdentidad(
  usuaria: UsuariaExpedienteHub,
  onGuardado: (usuaria: UsuariaExpedienteHub) => void,
): FormularioIdentidad {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const form = useForm<EditarIdentidadUsuariaInput>({
    resolver: zodResolver(editarIdentidadUsuariaSchema),
    mode: 'onChange',
    defaultValues: valoresIdentidad(usuaria),
  })
  const { dirtyFields, errors, isValid, isSubmitting } = form.formState
  const camposModificados = camposVisiblesModificados(dirtyFields)

  const guardar = form.handleSubmit(async (datos) => {
    setErrorEnvio(null)
    try {
      const { data } = await api.patch<UsuariaExpedienteHub>(`/trabajo-social/usuarias/${usuaria.id}`, datos)
      onGuardado(data)
    } catch (error) {
      // El único conflicto posible es el DPI de otra usuaria: el mensaje va junto a ese campo.
      if (axios.isAxiosError(error) && error.response?.status === HTTP_CONFLICTO) {
        form.setError('dpi', { type: 'servidor', message: extraerMensajeError(error) })
        return
      }
      setErrorEnvio(extraerMensajeError(error))
    }
  })

  function descartar() {
    setErrorEnvio(null)
    form.reset()
  }

  return {
    form,
    camposModificados,
    dpiModificado: camposModificados.includes('dpi'),
    esValido: isValid && Object.keys(errors).length === 0,
    guardar,
    descartar,
    errorEnvio,
    enviando: isSubmitting,
  }
}
