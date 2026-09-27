import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { formatInstanteGT, registroConsultaSchema, type CitaPsicologicaDetalle, type RegistroConsultaInput } from '@akyuam/shared'
import SelectInput from '../../../components/form/SelectInput'
import TextareaInput from '../../../components/form/TextareaInput'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerDetalleCita, registrarConsulta } from '../api/psicologia.api'

const OPCIONES_ESTADO = [
  { value: 'ATENDIDA', label: 'Atendida' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'NO_ASISTIO', label: 'No asistió' },
]

export default function RegistroConsulta() {
  const { citaId } = useParams<{ citaId: string }>()
  const navigate = useNavigate()

  const [cita, setCita] = useState<CitaPsicologicaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<'borrador' | 'final' | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof registroConsultaSchema>, any, RegistroConsultaInput>({
    resolver: zodResolver(registroConsultaSchema),
    defaultValues: {
      estado: 'ATENDIDA',
      temas: '',
      intervencion: '',
      recomendaciones: '',
      acuerdos: '',
      observaciones: '',
      motivoNoAsistencia: '',
      borrador: false,
    },
  })

  const estado = watch('estado')

  const cargar = useCallback(async () => {
    if (!citaId) return
    setError(null)
    try {
      const detalle = await obtenerDetalleCita(citaId)
      setCita(detalle)
      reset({
        estado: detalle.estado === 'PROGRAMADA' || detalle.estado === 'REPROGRAMADA' ? 'ATENDIDA' : detalle.estado,
        temas: detalle.temas ?? '',
        intervencion: detalle.intervencion ?? '',
        recomendaciones: detalle.recomendaciones ?? '',
        acuerdos: detalle.acuerdos ?? '',
        observaciones: detalle.observaciones ?? '',
        motivoNoAsistencia: detalle.motivoNoAsistencia ?? '',
        borrador: detalle.borrador,
      })
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [citaId, reset])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardarBorrador() {
    if (!citaId) return
    setErrorEnvio(null)
    setGuardando('borrador')
    try {
      await registrarConsulta(citaId, { ...getValues(), borrador: true })
      navigate(`/psicologia/citas/${citaId}`)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    } finally {
      setGuardando(null)
    }
  }

  async function finalizarRegistro(datos: RegistroConsultaInput) {
    if (!citaId) return
    setErrorEnvio(null)
    setGuardando('final')
    try {
      await registrarConsulta(citaId, { ...datos, borrador: false })
      navigate(`/psicologia/citas/${citaId}`)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    } finally {
      setGuardando(null)
    }
  }

  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (!cita) {
    return <p className="text-sm text-gray-500">Cargando cita…</p>
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">Registrar consulta</h1>
        <p className="text-sm text-gray-500">
          {cita.usuariaNombreCompleto} — {formatInstanteGT(cita.fechaHora)}
        </p>
      </div>

      <form onSubmit={handleSubmit(finalizarRegistro)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <SelectInput label="Resultado de la cita" registro={register('estado')} opciones={OPCIONES_ESTADO} error={errors.estado?.message} />

        {estado === 'ATENDIDA' ? (
          <>
            <TextareaInput label="Temas abordados" registro={register('temas')} opcional error={errors.temas?.message} />
            <TextareaInput label="Intervención" registro={register('intervencion')} opcional error={errors.intervencion?.message} />
            <TextareaInput label="Recomendaciones" registro={register('recomendaciones')} opcional error={errors.recomendaciones?.message} />
            <TextareaInput label="Acuerdos" registro={register('acuerdos')} opcional error={errors.acuerdos?.message} />
            <TextareaInput label="Observaciones" registro={register('observaciones')} opcional error={errors.observaciones?.message} />
          </>
        ) : (
          <TextareaInput
            label="Motivo"
            registro={register('motivoNoAsistencia')}
            ayuda="Requerido cuando la cita no fue atendida."
            error={errors.motivoNoAsistencia?.message}
          />
        )}

        {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variante="secondary" onClick={guardarBorrador} cargando={guardando === 'borrador'} disabled={guardando === 'final'}>
            Guardar borrador
          </Button>
          <Button type="submit" cargando={guardando === 'final'} disabled={guardando === 'borrador'}>
            Finalizar registro
          </Button>
        </div>
      </form>
    </div>
  )
}
