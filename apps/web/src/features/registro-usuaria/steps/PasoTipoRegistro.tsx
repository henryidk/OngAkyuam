import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  documentosRequeridos,
  ETIQUETAS_TIPO_DOCUMENTO,
  type RegistroUsuariaNuevaFormValues,
  type TipoRegistro,
} from '@akyuam/shared'
import TextoInput from '../../../components/form/TextoInput'

interface PasoTipoRegistroProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
}

const OPCIONES: { valor: TipoRegistro; titulo: string; descripcion: string }[] = [
  { valor: 'EXTERNA', titulo: 'Externa', descripcion: 'Recibe atención y regresa a su hogar.' },
  {
    valor: 'INTERNA',
    titulo: 'Interna · solicita albergue',
    descripcion: 'Ingresa al albergue, con hijas/hijos menores de 12 años.',
  },
]

export default function PasoTipoRegistro({ form }: PasoTipoRegistroProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const tipoRegistro = useWatch({ control, name: 'datosCaso.tipoRegistro' })

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="sr-only">Tipo de registro</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPCIONES.map((opcion) => (
            <label
              key={opcion.valor}
              className="cursor-pointer rounded-[10px] border-2 border-gray-200 p-4 text-left transition-colors has-checked:border-brand-600 has-checked:bg-brand-50 has-focus-visible:ring-2 has-focus-visible:ring-brand-500"
            >
              <input type="radio" value={opcion.valor} className="sr-only" {...register('datosCaso.tipoRegistro')} />
              <span className="block text-sm font-semibold text-gray-900">{opcion.titulo}</span>
              <span className="mt-1 block text-xs text-gray-500">{opcion.descripcion}</span>
            </label>
          ))}
        </div>
        {errors.datosCaso?.tipoRegistro?.message && (
          <p className="mt-2 text-sm text-red-600">{errors.datosCaso.tipoRegistro.message}</p>
        )}
      </fieldset>

      {tipoRegistro === 'INTERNA' && (
        <div className="grid gap-4 rounded-lg border border-brand-100 bg-brand-50 p-4 sm:grid-cols-2">
          <TextoInput
            label="Fecha de ingreso al albergue"
            type="date"
            registro={register('datosCaso.fechaIngresoAlbergue')}
            error={errors.datosCaso?.fechaIngresoAlbergue?.message}
          />
          <p className="self-end text-xs text-brand-700">
            Documentos requeridos para albergue:{' '}
            {documentosRequeridos('INTERNA', false)
              .map((tipo) => ETIQUETAS_TIPO_DOCUMENTO[tipo])
              .join(', ')}
            .
          </p>
        </div>
      )}
    </div>
  )
}
