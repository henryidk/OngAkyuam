import type { ChangeEvent } from 'react'
import { useWatch } from 'react-hook-form'
import {
  DEPARTAMENTOS_FUERA_ALTA_VERAPAZ,
  edadEnAniosGT,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  fechaCalendarioGT,
  formatFechaGT,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
} from '@akyuam/shared'
import Campo, { claseBordeCampo } from '../../../components/form/Campo'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'
import { rangoEdadCorto } from '../usuarias/filaUsuaria'
import { DEPARTAMENTO_ALTA_VERAPAZ, mapearDepartamento } from './mapearDepartamento'
import type { FormularioIdentidad } from './useFormularioIdentidad'

export type DisposicionIdentidad = 'cuadricula' | 'compacta'

interface FormularioIdentidadUsuariaProps {
  formulario: FormularioIdentidad
  /** Instante en que se registró a la usuaria: se muestra, no se edita. */
  registradaEl: string
  /** `cuadricula`: misma rejilla que la lectura de la ficha. `compacta`: dos columnas (wizard). */
  disposicion: DisposicionIdentidad
}

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/
const LONGITUD_DPI = 13
const ID_DEPARTAMENTO = 'departamento'

const CLASES_DISPOSICION: Record<DisposicionIdentidad, string> = {
  cuadricula: 'grid gap-x-6 gap-y-[18px] [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]',
  compacta: 'grid gap-x-4 gap-y-4 sm:grid-cols-2',
}

const opcionesGrupoEtnico = GRUPOS_ETNICOS.map((grupo) => ({ value: grupo, label: ETIQUETAS_GRUPO_ETNICO[grupo] }))
const opcionesMunicipio = MUNICIPIOS_ALTA_VERAPAZ.map((municipio) => ({
  value: municipio,
  label: ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[municipio],
}))
const DEPARTAMENTOS = [DEPARTAMENTO_ALTA_VERAPAZ, ...DEPARTAMENTOS_FUERA_ALTA_VERAPAZ]

function soloDigitosDpi(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, LONGITUD_DPI)
}

/**
 * Campos de identidad de la usuaria, sin botones ni envío: el estado llega por `formulario`
 * (ver `useFormularioIdentidad`) y quien lo contiene decide el pie y la navegación.
 */
export default function FormularioIdentidadUsuaria({
  formulario,
  registradaEl,
  disposicion,
}: FormularioIdentidadUsuariaProps) {
  const { form, camposModificados } = formulario
  const {
    register,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = form
  const modificado = (campo: (typeof camposModificados)[number]) => camposModificados.includes(campo)

  const dpi = useWatch({ control, name: 'dpi' })
  const fechaNacimiento = useWatch({ control, name: 'fechaNacimiento' })
  const fueraDeAltaVerapaz = useWatch({ control, name: 'fueraDeAltaVerapaz' })
  const departamentoOtro = useWatch({ control, name: 'departamentoOtro' })

  const registroDpi = register('dpi')
  const dpiIncompleto = dpi.length > 0 && dpi.length < LONGITUD_DPI
  const errorDpi = dpiIncompleto ? `Debe tener 13 dígitos (lleva ${dpi.length}).` : errors.dpi?.message
  const avisaDpiNuevo = modificado('dpi') && !errorDpi

  const edad = FECHA_ISO_REGEX.test(fechaNacimiento) ? edadEnAniosGT(fechaNacimiento) : null
  const errorMunicipio = errors.municipio
    ? fueraDeAltaVerapaz
      ? 'Escribe el municipio'
      : 'Selecciona un municipio'
    : undefined

  function onDepartamentoCambia(evento: ChangeEvent<HTMLSelectElement>) {
    const cambios = mapearDepartamento(evento.target.value)
    for (const [campo, valor] of Object.entries(cambios)) {
      setValue(campo as keyof typeof cambios, valor, { shouldDirty: true })
    }
    void trigger()
  }

  return (
    <div className={CLASES_DISPOSICION[disposicion]}>
      <TextoInput
        label="Nombres"
        registro={register('nombres')}
        error={errors.nombres?.message}
        modificado={modificado('nombres')}
      />
      <TextoInput
        label="Apellidos"
        registro={register('apellidos')}
        error={errors.apellidos?.message}
        modificado={modificado('apellidos')}
      />
      <TextoInput
        label="DPI"
        inputMode="numeric"
        maxLength={LONGITUD_DPI}
        className="tabular-nums"
        registro={{
          ...registroDpi,
          onChange: (evento) => {
            evento.target.value = soloDigitosDpi(evento.target.value)
            return registroDpi.onChange(evento)
          },
        }}
        error={errorDpi}
        ayuda={
          avisaDpiNuevo
            ? 'DPI nuevo · se pedirá confirmación al guardar.'
            : 'Solo puede quedar vacío si es menor de edad.'
        }
        tonoAyuda={avisaDpiNuevo ? 'aviso' : 'neutral'}
        modificado={modificado('dpi')}
      />
      <TextoInput
        label="Fecha de nacimiento"
        type="date"
        // La obligatoriedad del DPI depende de la edad: se revalida al cambiar la fecha.
        registro={register('fechaNacimiento', { deps: ['dpi'] })}
        error={errors.fechaNacimiento?.message}
        ayuda={edad !== null ? `${edad} años · rango ${rangoEdadCorto(edad)} (calculado)` : undefined}
        modificado={modificado('fechaNacimiento')}
      />
      <SelectInput
        label="Grupo étnico"
        placeholder="Selecciona un grupo étnico"
        opciones={opcionesGrupoEtnico}
        registro={register('grupoEtnico')}
        error={errors.grupoEtnico?.message}
        modificado={modificado('grupoEtnico')}
      />
      <TextoInput
        label="Teléfono"
        opcional
        inputMode="tel"
        className="tabular-nums"
        registro={register('telefono')}
        error={errors.telefono?.message}
        modificado={modificado('telefono')}
      />
      <Campo label="Departamento" htmlFor={ID_DEPARTAMENTO} modificado={modificado('departamento')}>
        <select
          id={ID_DEPARTAMENTO}
          value={fueraDeAltaVerapaz ? departamentoOtro : DEPARTAMENTO_ALTA_VERAPAZ}
          onChange={onDepartamentoCambia}
          className={`mt-1 w-full rounded border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${claseBordeCampo({ modificado: modificado('departamento') })}`}
        >
          {fueraDeAltaVerapaz && departamentoOtro === '' && <option value="">Selecciona un departamento</option>}
          {DEPARTAMENTOS.map((departamento) => (
            <option key={departamento} value={departamento}>
              {departamento}
            </option>
          ))}
        </select>
      </Campo>
      {fueraDeAltaVerapaz ? (
        <TextoInput
          label="Municipio"
          placeholder="Escribe el municipio"
          registro={register('municipioOtro', { deps: ['municipio'] })}
          error={errorMunicipio}
          modificado={modificado('municipio')}
        />
      ) : (
        <SelectInput
          label="Municipio"
          placeholder="Selecciona un municipio"
          opciones={opcionesMunicipio}
          registro={register('municipio')}
          error={errorMunicipio}
          modificado={modificado('municipio')}
        />
      )}
      <TextoInput
        label="Ubicación geográfica"
        ayuda="Aldea, zona, colonia o cantón."
        registro={register('ubicacionGeografica')}
        error={errors.ubicacionGeografica?.message}
        modificado={modificado('ubicacionGeografica')}
      />
      <TextoInput
        label="Dirección"
        opcional
        registro={register('direccion')}
        error={errors.direccion?.message}
        modificado={modificado('direccion')}
      />
      <div>
        <p className="text-sm font-medium text-gray-500">Registrada</p>
        <p className="mt-3 text-sm tabular-nums text-gray-500">
          {formatFechaGT(fechaCalendarioGT(new Date(registradaEl)))} · no editable
        </p>
      </div>
    </div>
  )
}
