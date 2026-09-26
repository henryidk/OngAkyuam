import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ETIQUETAS_MODALIDAD_CITA,
  MODALIDADES_CITA,
  programarCitaSchema,
  type ProgramarCitaInput,
} from '@akyuam/shared'
import SelectInput from '../../components/form/SelectInput'
import TextoInput from '../../components/form/TextoInput'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface FormularioNuevaCitaProps {
  expedienteId: string
  onCreada: () => void
  onCancelar: () => void
}

const OPCIONES_MODALIDAD = MODALIDADES_CITA.map((modalidad) => ({
  value: modalidad,
  label: ETIQUETAS_MODALIDAD_CITA[modalidad],
}))

export default function FormularioNuevaCita({ expedienteId, onCreada, onCancelar }: FormularioNuevaCitaProps) {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProgramarCitaInput>({
    resolver: zodResolver(programarCitaSchema),
    defaultValues: { fechaHora: '', modalidad: undefined, lugar: '', motivo: '' },
  })

  async function onSubmit(datos: ProgramarCitaInput) {
    setErrorEnvio(null)
    try {
      await api.post(`/psicologia/expedientes/${expedienteId}/citas`, datos)
      onCreada()
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TextoInput
        type="datetime-local"
        label="Fecha y hora"
        registro={register('fechaHora')}
        error={errors.fechaHora?.message}
      />
      <SelectInput
        label="Modalidad"
        registro={register('modalidad')}
        opciones={OPCIONES_MODALIDAD}
        placeholder="Seleccionar…"
        error={errors.modalidad?.message}
      />
      <TextoInput label="Lugar" registro={register('lugar')} opcional error={errors.lugar?.message} />
      <TextoInput label="Motivo" registro={register('motivo')} error={errors.motivo?.message} />

      {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variante="secondary" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" cargando={isSubmitting}>
          Programar cita
        </Button>
      </div>
    </form>
  )
}
