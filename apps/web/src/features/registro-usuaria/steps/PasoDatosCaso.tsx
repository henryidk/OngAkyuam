import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  DEPARTAMENTOS_FUERA_ALTA_VERAPAZ,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  MUNICIPIOS_ALTA_VERAPAZ,
  type RegistroUsuariaFormValues,
} from '@akyuam/shared'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'

interface PasoDatosCasoProps {
  form: UseFormReturn<RegistroUsuariaFormValues>
}

const opcionesMunicipio = MUNICIPIOS_ALTA_VERAPAZ.map((municipio) => ({
  value: municipio,
  label: ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[municipio],
}))

const opcionesDepartamentoOtro = DEPARTAMENTOS_FUERA_ALTA_VERAPAZ.map((departamento) => ({
  value: departamento,
  label: departamento,
}))

export default function PasoDatosCaso({ form }: PasoDatosCasoProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const fueraDeAltaVerapaz = useWatch({ control, name: 'datosCaso.fueraDeAltaVerapaz' })

  return (
    <div className="space-y-4">
      <div className="rounded border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
        El número de expediente se asignará automáticamente al guardar el registro.
      </div>

      <TextoInput
        label="Fecha"
        type="date"
        registro={register('datosCaso.fecha')}
        error={errors.datosCaso?.fecha?.message}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          {...register('datosCaso.fueraDeAltaVerapaz')}
        />
        La usuaria es de fuera de Alta Verapaz
      </label>

      {fueraDeAltaVerapaz ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            label="Departamento de origen"
            placeholder="Selecciona un departamento"
            opciones={opcionesDepartamentoOtro}
            registro={register('datosCaso.departamentoOtro')}
            error={errors.datosCaso?.departamentoOtro?.message}
          />
          <TextoInput
            label="Municipio de origen"
            registro={register('datosCaso.municipioOtro')}
            error={errors.datosCaso?.municipioOtro?.message}
          />
        </div>
      ) : (
        <SelectInput
          label="Municipio"
          placeholder="Selecciona un municipio"
          opciones={opcionesMunicipio}
          registro={register('datosCaso.municipio')}
          error={errors.datosCaso?.municipio?.message}
        />
      )}

      <TextoInput
        label="Ubicación geográfica"
        ayuda="Aldea, zona, colonia o cantón donde ocurrió o vive la usuaria."
        registro={register('datosCaso.ubicacionGeografica')}
        error={errors.datosCaso?.ubicacionGeografica?.message}
      />
    </div>
  )
}
