import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  documentosRequeridos,
  ETIQUETAS_TIPO_DOCUMENTO,
  type RegistroUsuariaNuevaFormValues,
} from '@akyuam/shared'
import TarjetasTipoRegistro from '../../../components/form/TarjetasTipoRegistro'
import TextoInput from '../../../components/form/TextoInput'

interface PasoTipoRegistroProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
}

export default function PasoTipoRegistro({ form }: PasoTipoRegistroProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const tipoRegistro = useWatch({ control, name: 'datosCaso.tipoRegistro' })

  return (
    <div className="flex flex-col gap-5">
      <TarjetasTipoRegistro
        registro={register('datosCaso.tipoRegistro')}
        error={errors.datosCaso?.tipoRegistro?.message}
      />

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
