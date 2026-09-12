import type { UseFormReturn } from 'react-hook-form'
import type { RegistroUsuariaFormValues } from '@akyuam/shared'
import TextoInput from '../../../components/form/TextoInput'

interface PasoDatosAgresorProps {
  form: UseFormReturn<RegistroUsuariaFormValues>
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
          registro={register('datosAgresor.nombres')}
          error={errors.datosAgresor?.nombres?.message}
        />
        <TextoInput
          label="Apellidos"
          opcional
          registro={register('datosAgresor.apellidos')}
          error={errors.datosAgresor?.apellidos?.message}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextoInput
          label="Teléfono"
          opcional
          registro={register('datosAgresor.telefono')}
          error={errors.datosAgresor?.telefono?.message}
        />
        <TextoInput
          label="Dirección"
          opcional
          registro={register('datosAgresor.direccion')}
          error={errors.datosAgresor?.direccion?.message}
        />
      </div>
    </div>
  )
}
