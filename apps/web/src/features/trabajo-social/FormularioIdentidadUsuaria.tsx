import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  calcularRangoEdad,
  DEPARTAMENTOS_FUERA_ALTA_VERAPAZ,
  edadEnAniosGT,
  editarIdentidadUsuariaSchema,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  type EditarIdentidadUsuariaInput,
  type UsuariaExpedienteHub,
} from '@akyuam/shared'
import SelectInput from '../../components/form/SelectInput'
import TextoInput from '../../components/form/TextoInput'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface FormularioIdentidadUsuariaProps {
  usuaria: UsuariaExpedienteHub
  onGuardado: (usuaria: UsuariaExpedienteHub) => void
  onCancelar: () => void
}

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

const opcionesGrupoEtnico = GRUPOS_ETNICOS.map((grupo) => ({ value: grupo, label: ETIQUETAS_GRUPO_ETNICO[grupo] }))
const opcionesMunicipio = MUNICIPIOS_ALTA_VERAPAZ.map((municipio) => ({
  value: municipio,
  label: ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[municipio],
}))
const opcionesDepartamentoOtro = DEPARTAMENTOS_FUERA_ALTA_VERAPAZ.map((departamento) => ({
  value: departamento,
  label: departamento,
}))

/**
 * PATCH inmediato e independiente del submit del caso (ver plan): editar teléfono/dirección/
 * ubicación de una usuaria nunca viaja empaquetado con la creación de un expediente.
 */
export default function FormularioIdentidadUsuaria({
  usuaria,
  onGuardado,
  onCancelar,
}: FormularioIdentidadUsuariaProps) {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditarIdentidadUsuariaInput>({
    resolver: zodResolver(editarIdentidadUsuariaSchema),
    defaultValues: {
      nombres: usuaria.nombres,
      apellidos: usuaria.apellidos,
      dpi: usuaria.dpi ?? '',
      telefono: usuaria.telefono ?? '',
      direccion: usuaria.direccion ?? '',
      fechaNacimiento: usuaria.fechaNacimiento,
      grupoEtnico: usuaria.grupoEtnico as EditarIdentidadUsuariaInput['grupoEtnico'],
      fueraDeAltaVerapaz: usuaria.municipio === null,
      municipio: usuaria.municipio ?? '',
      departamentoOtro: usuaria.departamentoOtro ?? '',
      municipioOtro: usuaria.municipioOtro ?? '',
      ubicacionGeografica: usuaria.ubicacionGeografica ?? '',
    },
  })

  const fechaNacimiento = useWatch({ control, name: 'fechaNacimiento' })
  const fueraDeAltaVerapaz = useWatch({ control, name: 'fueraDeAltaVerapaz' })
  const rangoEdad = FECHA_ISO_REGEX.test(fechaNacimiento ?? '')
    ? calcularRangoEdad(edadEnAniosGT(fechaNacimiento))
    : null

  async function onSubmit(datos: EditarIdentidadUsuariaInput) {
    setErrorEnvio(null)
    try {
      const { data } = await api.patch<UsuariaExpedienteHub>(
        `/trabajo-social/usuarias/${usuaria.id}`,
        datos,
      )
      onGuardado(data)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput label="Nombres" registro={register('nombres')} error={errors.nombres?.message} />
        <TextoInput label="Apellidos" registro={register('apellidos')} error={errors.apellidos?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput
          label="DPI"
          opcional
          inputMode="numeric"
          maxLength={13}
          ayuda="13 dígitos, sin espacios ni guiones."
          registro={register('dpi')}
          error={errors.dpi?.message}
        />
        <TextoInput label="Teléfono" opcional registro={register('telefono')} error={errors.telefono?.message} />
      </div>

      <TextoInput label="Dirección" opcional registro={register('direccion')} error={errors.direccion?.message} />

      <div>
        <TextoInput
          label="Fecha de nacimiento"
          type="date"
          registro={register('fechaNacimiento')}
          error={errors.fechaNacimiento?.message}
        />
        {rangoEdad && (
          <p className="mt-1 text-xs text-gray-500">
            Rango de edad para estadística: <span className="font-medium text-brand-700">{ETIQUETAS_RANGO_EDAD[rangoEdad]}</span>{' '}
            (calculado automáticamente).
          </p>
        )}
      </div>

      <SelectInput
        label="Grupo étnico"
        placeholder="Selecciona un grupo étnico"
        opciones={opcionesGrupoEtnico}
        registro={register('grupoEtnico')}
        error={errors.grupoEtnico?.message}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          {...register('fueraDeAltaVerapaz')}
        />
        La usuaria es de fuera de Alta Verapaz
      </label>

      {fueraDeAltaVerapaz ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            label="Departamento de origen"
            placeholder="Selecciona un departamento"
            opciones={opcionesDepartamentoOtro}
            registro={register('departamentoOtro')}
            error={errors.departamentoOtro?.message}
          />
          <TextoInput
            label="Municipio de origen"
            registro={register('municipioOtro')}
            error={errors.municipioOtro?.message}
          />
        </div>
      ) : (
        <SelectInput
          label="Municipio"
          placeholder="Selecciona un municipio"
          opciones={opcionesMunicipio}
          registro={register('municipio')}
          error={errors.municipio?.message}
        />
      )}

      <TextoInput
        label="Ubicación geográfica"
        ayuda="Aldea, zona, colonia o cantón donde vive la usuaria."
        registro={register('ubicacionGeografica')}
        error={errors.ubicacionGeografica?.message}
      />

      {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variante="secondary" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" cargando={isSubmitting}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}
