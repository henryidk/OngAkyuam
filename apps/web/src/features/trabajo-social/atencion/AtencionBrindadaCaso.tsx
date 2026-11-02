import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ACCION_TRABAJO_SOCIAL_MAX,
  formatFechaGT,
  hoyGT,
  registrarAccionTrabajoSocialSchema,
  type AccionTrabajoSocialDto,
  type RegistrarAccionTrabajoSocialInput,
} from '@akyuam/shared'
import TextareaInput from '../../../components/form/TextareaInput'
import TextoInput from '../../../components/form/TextoInput'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { listarAccionesCaso, registrarAccionCaso } from '../api/trabajoSocial.api'

interface AtencionBrindadaCasoProps {
  expedienteId: string
}

/**
 * "Atención brindada" de Trabajo Social en un caso: una lista con fecha de cada entrevista,
 * orientación o gestión. Alimenta la columna del mismo nombre en el reporte de población.
 */
export default function AtencionBrindadaCaso({ expedienteId }: AtencionBrindadaCasoProps) {
  const [acciones, setAcciones] = useState<AccionTrabajoSocialDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setError(null)
    listarAccionesCaso(expedienteId)
      .then((datos) => {
        if (!cancelado) setAcciones(datos)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId])

  function onRegistrada(accion: AccionTrabajoSocialDto) {
    setAcciones((previas) =>
      [accion, ...(previas ?? [])].sort((a, b) =>
        a.fecha === b.fecha ? b.createdAt.localeCompare(a.createdAt) : b.fecha.localeCompare(a.fecha),
      ),
    )
    setAgregando(false)
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-gray-800">Atención brindada</h3>
        {!agregando && (
          <Button type="button" variante="secondary" onClick={() => setAgregando(true)}>
            Registrar atención
          </Button>
        )}
      </div>

      {agregando && (
        <FormularioAccion expedienteId={expedienteId} onRegistrada={onRegistrada} onCancelar={() => setAgregando(false)} />
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && !acciones && <div className="h-10 animate-pulse rounded bg-gray-100" />}
      {acciones && acciones.length === 0 && !agregando && (
        <p className="text-sm text-gray-500">Todavía no se registró ninguna atención en este caso.</p>
      )}
      {acciones && acciones.length > 0 && (
        <ul className="space-y-2">
          {acciones.map((accion) => (
            <li key={accion.id} className="text-sm">
              <p className="text-gray-800">
                <span className="font-medium tabular-nums">{formatFechaGT(accion.fecha)}</span> ·{' '}
                <span className="whitespace-pre-line">{accion.descripcion}</span>
              </p>
              <p className="text-xs text-gray-500">{accion.registradaPor}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormularioAccion({
  expedienteId,
  onRegistrada,
  onCancelar,
}: {
  expedienteId: string
  onRegistrada: (accion: AccionTrabajoSocialDto) => void
  onCancelar: () => void
}) {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrarAccionTrabajoSocialInput>({
    resolver: zodResolver(registrarAccionTrabajoSocialSchema),
    defaultValues: { fecha: hoyGT(), descripcion: '' },
  })

  async function onSubmit(datos: RegistrarAccionTrabajoSocialInput) {
    setErrorEnvio(null)
    try {
      onRegistrada(await registrarAccionCaso(expedienteId, datos))
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="max-w-[200px]">
        <TextoInput label="Fecha" type="date" max={hoyGT()} registro={register('fecha')} error={errors.fecha?.message} />
      </div>
      <TextareaInput
        label="Descripción"
        rows={3}
        maxLength={ACCION_TRABAJO_SOCIAL_MAX}
        registro={register('descripcion')}
        error={errors.descripcion?.message}
      />
      {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variante="secondary" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" cargando={isSubmitting}>
          Guardar
        </Button>
      </div>
    </form>
  )
}
