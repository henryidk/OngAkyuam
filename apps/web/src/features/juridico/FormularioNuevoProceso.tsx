import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  crearProcesoJuridicoSchema,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  TIPOS_PROCESO_JURIDICO,
  type CrearProcesoJuridicoInput,
  type PersonalDto,
} from '@akyuam/shared'
import SelectInput from '../../components/form/SelectInput'
import TextoInput from '../../components/form/TextoInput'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface FormularioNuevoProcesoProps {
  expedienteId: string
  abogadas: PersonalDto[]
  procuradoras: PersonalDto[]
  onCreado: () => void
  onCancelar: () => void
}

const OPCIONES_TIPO = TIPOS_PROCESO_JURIDICO.map((tipo) => ({
  value: tipo,
  label: ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo],
}))

export default function FormularioNuevoProceso({
  expedienteId,
  abogadas,
  procuradoras,
  onCreado,
  onCancelar,
}: FormularioNuevoProcesoProps) {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrearProcesoJuridicoInput>({
    resolver: zodResolver(crearProcesoJuridicoSchema),
    defaultValues: { tipo: undefined, abogadaId: '', procuradoraId: '', fechaInicio: '' },
  })

  async function onSubmit(datos: CrearProcesoJuridicoInput) {
    setErrorEnvio(null)
    try {
      await api.post(`/juridico/expedientes/${expedienteId}/procesos`, datos)
      onCreado()
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <SelectInput
        label="Tipo de proceso"
        registro={register('tipo')}
        opciones={OPCIONES_TIPO}
        placeholder="Seleccionar…"
        error={errors.tipo?.message}
      />
      <SelectInput
        label="Abogada asignada"
        registro={register('abogadaId')}
        opciones={abogadas.map((abogada) => ({ value: abogada.id, label: abogada.nombre }))}
        placeholder="Sin asignar"
        opcional
        error={errors.abogadaId?.message}
      />
      <SelectInput
        label="Procuradora asignada"
        registro={register('procuradoraId')}
        opciones={procuradoras.map((procuradora) => ({ value: procuradora.id, label: procuradora.nombre }))}
        placeholder="Sin asignar"
        opcional
        error={errors.procuradoraId?.message}
      />
      <TextoInput
        type="date"
        label="Fecha de inicio"
        registro={register('fechaInicio')}
        error={errors.fechaInicio?.message}
      />

      {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variante="secondary" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" cargando={isSubmitting}>
          Crear proceso
        </Button>
      </div>
    </form>
  )
}
