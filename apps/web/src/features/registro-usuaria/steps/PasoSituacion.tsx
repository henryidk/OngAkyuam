import type { UseFormReturn } from 'react-hook-form'
import { OBSERVACIONES_CASO_MAX, type RegistroUsuariaNuevaFormValues } from '@akyuam/shared'
import TextareaInput from '../../../components/form/TextareaInput'
import TextoInput from '../../../components/form/TextoInput'
import TipologiaChips from '../../../components/form/TipologiaChips'

interface PasoSituacionProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
  sinDatosAgresor: boolean
  onCambiarSinDatosAgresor: (valor: boolean) => void
}

const CAMPOS_AGRESOR = ['nombres', 'apellidos', 'telefono', 'direccion'] as const

export default function PasoSituacion({ form, sinDatosAgresor, onCambiarSinDatosAgresor }: PasoSituacionProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = form

  function alternarSinDatos(marcado: boolean) {
    onCambiarSinDatosAgresor(marcado)
    // Se vacían en vez de deshabilitar el input con RHF: un input deshabilitado llega como
    // `undefined` y el schema (strings planos) lo rechazaría.
    if (marcado) {
      for (const campo of CAMPOS_AGRESOR) {
        setValue(`datosCaso.datosAgresor.${campo}`, '', { shouldValidate: true })
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TipologiaChips
        registro={register('datosCaso.tipologiaDelito')}
        error={errors.datosCaso?.tipologiaDelito?.message}
      />

      <section className="border-t border-gray-100 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-800">Datos del agresor</h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={sinDatosAgresor}
              onChange={(event) => alternarSinDatos(event.target.checked)}
            />
            La usuaria no proporcionó datos
          </label>
        </div>
        <div className={`grid gap-4 sm:grid-cols-2 ${sinDatosAgresor ? 'pointer-events-none opacity-50' : ''}`}>
          <TextoInput
            label="Nombres"
            opcional
            readOnly={sinDatosAgresor}
            tabIndex={sinDatosAgresor ? -1 : undefined}
            registro={register('datosCaso.datosAgresor.nombres')}
            error={errors.datosCaso?.datosAgresor?.nombres?.message}
          />
          <TextoInput
            label="Apellidos"
            opcional
            readOnly={sinDatosAgresor}
            tabIndex={sinDatosAgresor ? -1 : undefined}
            registro={register('datosCaso.datosAgresor.apellidos')}
            error={errors.datosCaso?.datosAgresor?.apellidos?.message}
          />
          <TextoInput
            label="Teléfono"
            opcional
            readOnly={sinDatosAgresor}
            tabIndex={sinDatosAgresor ? -1 : undefined}
            registro={register('datosCaso.datosAgresor.telefono')}
            error={errors.datosCaso?.datosAgresor?.telefono?.message}
          />
          <TextoInput
            label="Dirección"
            opcional
            readOnly={sinDatosAgresor}
            tabIndex={sinDatosAgresor ? -1 : undefined}
            registro={register('datosCaso.datosAgresor.direccion')}
            error={errors.datosCaso?.datosAgresor?.direccion?.message}
          />
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <TextareaInput
          label="Observaciones"
          opcional
          rows={3}
          maxLength={OBSERVACIONES_CASO_MAX}
          registro={register('datosCaso.observaciones')}
          error={errors.datosCaso?.observaciones?.message}
        />
      </section>
    </div>
  )
}
