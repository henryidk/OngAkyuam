import type { UseFormReturn } from 'react-hook-form'
import {
  ETIQUETAS_TIPOLOGIA_DELITO,
  TIPOLOGIAS_DELITO,
  type RegistroUsuariaNuevaFormValues,
} from '@akyuam/shared'
import GrupoCheckbox from '../../../components/form/GrupoCheckbox'
import TextoInput from '../../../components/form/TextoInput'

interface PasoDatosCasoProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
}

const opcionesTipologia = TIPOLOGIAS_DELITO.map((tipologia) => ({
  value: tipologia,
  label: ETIQUETAS_TIPOLOGIA_DELITO[tipologia],
}))

export default function PasoDatosCaso({ form }: PasoDatosCasoProps) {
  const {
    register,
    formState: { errors },
  } = form

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

      <GrupoCheckbox
        label="Tipología del delito"
        ayuda="Puedes seleccionar una o varias."
        opciones={opcionesTipologia}
        registro={register('datosCaso.tipologiaDelito')}
        error={errors.datosCaso?.tipologiaDelito?.message}
      />
    </div>
  )
}
