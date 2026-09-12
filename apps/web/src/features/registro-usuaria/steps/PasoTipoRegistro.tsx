import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useWatch, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form'
import { ETIQUETAS_TIPO_REGISTRO, TIPOS_REGISTRO, type RegistroUsuariaFormValues } from '@akyuam/shared'
import GrupoRadio from '../../../components/form/GrupoRadio'
import TarjetaNino from '../components/TarjetaNino'

interface PasoTipoRegistroProps {
  form: UseFormReturn<RegistroUsuariaFormValues>
  ninosFieldArray: UseFieldArrayReturn<RegistroUsuariaFormValues, 'ninos'>
}

const opcionesTipoRegistro = TIPOS_REGISTRO.map((tipo) => ({ value: tipo, label: ETIQUETAS_TIPO_REGISTRO[tipo] }))

export default function PasoTipoRegistro({ form, ninosFieldArray }: PasoTipoRegistroProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const tipoRegistro = useWatch({ control, name: 'tipoRegistro' })
  const { fields, append, remove } = ninosFieldArray
  const [indiceExpandido, setIndiceExpandido] = useState<number | null>(null)

  function agregarNino() {
    append({ nombres: '', apellidos: '', fechaNacimiento: '', genero: 'M' })
    setIndiceExpandido(fields.length)
  }

  function quitarNino(indice: number) {
    remove(indice)
    setIndiceExpandido((actual) => (actual === indice ? null : actual))
  }

  return (
    <div className="space-y-6">
      <GrupoRadio
        label="Tipo de registro"
        opciones={opcionesTipoRegistro}
        registro={register('tipoRegistro')}
        error={errors.tipoRegistro?.message}
      />

      {tipoRegistro === 'INTERNA' && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-4">
          <h3 className="text-sm font-semibold text-gray-800">Niñas y niños que ingresan con la usuaria</h3>
          <p className="mt-1 text-xs text-gray-500">
            Solo se aceptan menores de 12 años. La fecha, ubicación, tipología del delito y grupo étnico ya
            capturados se comparten automáticamente — aquí solo se pide el dato propio de cada niña o niño.
          </p>

          {fields.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">Si la usuaria no tiene hijas o hijos, deja esta sección vacía.</p>
          ) : (
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {fields.map((field, indice) => (
                <TarjetaNino
                  key={field.id}
                  form={form}
                  indice={indice}
                  expandido={indiceExpandido === indice}
                  onExpandir={() => setIndiceExpandido(indice)}
                  onColapsar={() => setIndiceExpandido(null)}
                  onEliminar={() => quitarNino(indice)}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={agregarNino}
            className="mt-3 flex items-center gap-1.5 rounded border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus size={15} strokeWidth={2.25} />
            Agregar niña o niño
          </button>

          {errors.ninos?.message && <p className="mt-2 text-sm text-red-600">{errors.ninos.message}</p>}
        </div>
      )}
    </div>
  )
}
