import type { UseFormReturn } from 'react-hook-form'
import type { RegistroUsuariaNuevaFormValues } from '@akyuam/shared'
import TextoInput from '../../../components/form/TextoInput'

interface PasoDatosAgresorProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
}

export default function PasoDatosAgresor({ form }: PasoDatosAgresorProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Completa estos datos solo si la usuaria los proporcionó. Ninguno es obligatorio.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput
          label="Nombres"
          opcional
          registro={register('datosCaso.datosAgresor.nombres')}
          error={errors.datosCaso?.datosAgresor?.nombres?.message}
        />
        <TextoInput
          label="Apellidos"
          opcional
          registro={register('datosCaso.datosAgresor.apellidos')}
          error={errors.datosCaso?.datosAgresor?.apellidos?.message}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput
          label="Teléfono"
          opcional
          registro={register('datosCaso.datosAgresor.telefono')}
          error={errors.datosCaso?.datosAgresor?.telefono?.message}
        />
        <TextoInput
          label="Dirección"
          opcional
          registro={register('datosCaso.datosAgresor.direccion')}
          error={errors.datosCaso?.datosAgresor?.direccion?.message}
        />
      </div>
    </div>
  )
}
