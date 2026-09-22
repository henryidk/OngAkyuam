import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  calcularRangoEdad,
  edadEnAniosGT,
  DEPARTAMENTOS_FUERA_ALTA_VERAPAZ,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  type RegistroUsuariaNuevaFormValues,
} from '@akyuam/shared'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'

interface PasoDatosUsuariaProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
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

export default function PasoDatosUsuaria({ form }: PasoDatosUsuariaProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const fechaNacimiento = useWatch({ control, name: 'datosUsuaria.fechaNacimiento' })
  const fueraDeAltaVerapaz = useWatch({ control, name: 'datosUsuaria.fueraDeAltaVerapaz' })
  const rangoEdad = FECHA_ISO_REGEX.test(fechaNacimiento ?? '')
    ? calcularRangoEdad(edadEnAniosGT(fechaNacimiento))
    : null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput
          label="Nombres"
          registro={register('datosUsuaria.nombres')}
          error={errors.datosUsuaria?.nombres?.message}
        />
        <TextoInput
          label="Apellidos"
          registro={register('datosUsuaria.apellidos')}
          error={errors.datosUsuaria?.apellidos?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput
          label="DPI"
          opcional
          inputMode="numeric"
          maxLength={13}
          ayuda="13 dígitos, sin espacios ni guiones."
          registro={register('datosUsuaria.dpi')}
          error={errors.datosUsuaria?.dpi?.message}
        />
        <TextoInput
          label="Teléfono"
          opcional
          registro={register('datosUsuaria.telefono')}
          error={errors.datosUsuaria?.telefono?.message}
        />
      </div>

      <TextoInput
        label="Dirección"
        opcional
        registro={register('datosUsuaria.direccion')}
        error={errors.datosUsuaria?.direccion?.message}
      />

      <div>
        <TextoInput
          label="Fecha de nacimiento"
          type="date"
          registro={register('datosUsuaria.fechaNacimiento')}
          error={errors.datosUsuaria?.fechaNacimiento?.message}
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
        registro={register('datosUsuaria.grupoEtnico')}
        error={errors.datosUsuaria?.grupoEtnico?.message}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          {...register('datosUsuaria.fueraDeAltaVerapaz')}
        />
        La usuaria es de fuera de Alta Verapaz
      </label>

      {fueraDeAltaVerapaz ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            label="Departamento de origen"
            placeholder="Selecciona un departamento"
            opciones={opcionesDepartamentoOtro}
            registro={register('datosUsuaria.departamentoOtro')}
            error={errors.datosUsuaria?.departamentoOtro?.message}
          />
          <TextoInput
            label="Municipio de origen"
            registro={register('datosUsuaria.municipioOtro')}
            error={errors.datosUsuaria?.municipioOtro?.message}
          />
        </div>
      ) : (
        <SelectInput
          label="Municipio"
          placeholder="Selecciona un municipio"
          opciones={opcionesMunicipio}
          registro={register('datosUsuaria.municipio')}
          error={errors.datosUsuaria?.municipio?.message}
        />
      )}

      <TextoInput
        label="Ubicación geográfica"
        ayuda="Aldea, zona, colonia o cantón donde vive la usuaria."
        registro={register('datosUsuaria.ubicacionGeografica')}
        error={errors.datosUsuaria?.ubicacionGeografica?.message}
      />
    </div>
  )
}
