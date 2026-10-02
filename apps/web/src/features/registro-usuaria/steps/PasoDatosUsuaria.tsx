import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  calcularRangoEdad,
  edadEnAniosGT,
  DEPARTAMENTOS_FUERA_ALTA_VERAPAZ,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_RANGO_EDAD,
  MUNICIPIOS_ALTA_VERAPAZ,
  type RegistroUsuariaNuevaFormValues,
  type UsuariaResumenBusqueda,
} from '@akyuam/shared'
import GrupoEtnicoSegmentado from '../../../components/form/GrupoEtnicoSegmentado'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'
import AvisoPosibleDuplicada from '../components/AvisoPosibleDuplicada'
import VerificarDpi from '../components/VerificarDpi'

interface PasoDatosUsuariaProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
  /** Usuarias ya registradas que podrían ser la misma persona (solo se buscan si no hay DPI: menores de edad). */
  posiblesDuplicadas: UsuariaResumenBusqueda[]
  /** La usuaria ya existía: se abandona la captura de identidad y se registra un caso para ella. */
  onRegistrarCasoPara: (usuariaId: string) => void
}

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

const opcionesMunicipio = MUNICIPIOS_ALTA_VERAPAZ.map((municipio) => ({
  value: municipio,
  label: ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[municipio],
}))

const opcionesDepartamentoOtro = DEPARTAMENTOS_FUERA_ALTA_VERAPAZ.map((departamento) => ({
  value: departamento,
  label: departamento,
}))

export default function PasoDatosUsuaria({ form, posiblesDuplicadas, onRegistrarCasoPara }: PasoDatosUsuariaProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const fechaNacimiento = useWatch({ control, name: 'datosUsuaria.fechaNacimiento' })
  const fueraDeAltaVerapaz = useWatch({ control, name: 'datosUsuaria.fueraDeAltaVerapaz' })
  const dpi = useWatch({ control, name: 'datosUsuaria.dpi' })
  const edad = FECHA_ISO_REGEX.test(fechaNacimiento ?? '') ? edadEnAniosGT(fechaNacimiento) : null
  const rangoEdad = edad !== null && edad >= 0 ? calcularRangoEdad(edad) : null

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
        <div>
          <TextoInput
            label="DPI"
            inputMode="numeric"
            maxLength={13}
            ayuda="13 dígitos, sin espacios ni guiones. Solo puede quedar vacío si es menor de edad."
            registro={register('datosUsuaria.dpi')}
            error={errors.datosUsuaria?.dpi?.message}
          />
          <VerificarDpi dpi={dpi ?? ''} onRegistrarCasoPara={onRegistrarCasoPara} />
        </div>
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
        {edad !== null && rangoEdad && (
          <p className="mt-1 text-xs text-gray-500" aria-live="polite">
            Edad: <span className="font-semibold text-brand-700">{edad} {edad === 1 ? 'año' : 'años'}</span> · Rango:{' '}
            <span className="font-semibold text-brand-700">{ETIQUETAS_RANGO_EDAD[rangoEdad]}</span> (calculados)
          </p>
        )}
      </div>

      <GrupoEtnicoSegmentado
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

      {posiblesDuplicadas.length > 0 && (
        <AvisoPosibleDuplicada coincidencias={posiblesDuplicadas} onRegistrarCasoPara={onRegistrarCasoPara} />
      )}
    </div>
  )
}
