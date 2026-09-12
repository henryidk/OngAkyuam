import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  calcularRangoEdad,
  edadEnAniosGT,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_RANGO_EDAD,
  ETIQUETAS_TIPOLOGIA_DELITO,
  GRUPOS_ETNICOS,
  TIPOLOGIAS_DELITO,
  type RegistroUsuariaFormValues,
} from '@akyuam/shared'
import GrupoCheckbox from '../../../components/form/GrupoCheckbox'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'

interface PasoDatosUsuariaProps {
  form: UseFormReturn<RegistroUsuariaFormValues>
}

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

const opcionesGrupoEtnico = GRUPOS_ETNICOS.map((grupo) => ({ value: grupo, label: ETIQUETAS_GRUPO_ETNICO[grupo] }))
const opcionesTipologia = TIPOLOGIAS_DELITO.map((tipologia) => ({
  value: tipologia,
  label: ETIQUETAS_TIPOLOGIA_DELITO[tipologia],
}))

export default function PasoDatosUsuaria({ form }: PasoDatosUsuariaProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const fechaNacimiento = useWatch({ control, name: 'datosUsuaria.fechaNacimiento' })
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

      <GrupoCheckbox
        label="Tipología del delito"
        ayuda="Puedes seleccionar una o varias."
        opciones={opcionesTipologia}
        registro={register('datosUsuaria.tipologiaDelito')}
        error={errors.datosUsuaria?.tipologiaDelito?.message}
      />
    </div>
  )
}
