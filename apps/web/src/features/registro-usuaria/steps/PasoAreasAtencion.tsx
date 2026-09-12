import type { UseFormReturn } from 'react-hook-form'
import { AREAS_ATENCION, ETIQUETAS_AREA_ATENCION, type RegistroUsuariaFormValues } from '@akyuam/shared'
import GrupoCheckbox from '../../../components/form/GrupoCheckbox'

interface PasoAreasAtencionProps {
  form: UseFormReturn<RegistroUsuariaFormValues>
}

const opcionesAreas = AREAS_ATENCION.map((area) => ({ value: area, label: ETIQUETAS_AREA_ATENCION[area] }))

export default function PasoAreasAtencion({ form }: PasoAreasAtencionProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-6">
      <GrupoCheckbox
        label="Referir a otras áreas de atención"
        ayuda="Las áreas seleccionadas tendrán acceso a los datos de este expediente. Puedes dejarlo vacío si aún no corresponde."
        opciones={opcionesAreas}
        registro={register('areasReferidas')}
        error={errors.areasReferidas?.message}
      />
    </div>
  )
}
