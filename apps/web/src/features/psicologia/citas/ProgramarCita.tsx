import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import type { z } from 'zod'
import {
  DURACION_CITA_PSICOLOGICA_MINUTOS_DEFAULT,
  ETIQUETAS_MODALIDAD_CITA,
  ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  MODALIDADES_CITA,
  TIPOS_CITA_PSICOLOGICA,
  programarCitaSchema,
  type CitaResumen,
  type ProgramarCitaInput,
} from '@akyuam/shared'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { programarCita, reprogramarCita } from '../api/psicologia.api'
import FilaCita from './FilaCita'

const OPCIONES_MODALIDAD = MODALIDADES_CITA.map((modalidad) => ({
  value: modalidad,
  label: ETIQUETAS_MODALIDAD_CITA[modalidad],
}))
const OPCIONES_TIPO = TIPOS_CITA_PSICOLOGICA.map((tipo) => ({
  value: tipo,
  label: ETIQUETAS_TIPO_CITA_PSICOLOGICA[tipo],
}))

export default function ProgramarCita() {
  const { expedienteId } = useParams<{ expedienteId: string }>()
  const [searchParams] = useSearchParams()
  const citaAReprogramar = searchParams.get('reprograma')
  const navigate = useNavigate()

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof programarCitaSchema>, any, ProgramarCitaInput>({
    resolver: zodResolver(programarCitaSchema),
    defaultValues: {
      fechaHora: '',
      modalidad: undefined,
      lugar: '',
      motivo: '',
      tipo: 'SEGUIMIENTO',
      duracionMinutos: DURACION_CITA_PSICOLOGICA_MINUTOS_DEFAULT,
      confirmarTraslape: false,
    },
  })

  async function enviar(datos: ProgramarCitaInput, confirmarTraslape: boolean) {
    if (!expedienteId) return
    setErrorEnvio(null)
    try {
      if (citaAReprogramar) {
        await reprogramarCita(citaAReprogramar, {
          fechaHora: datos.fechaHora,
          modalidad: datos.modalidad,
          lugar: datos.lugar,
          motivo: datos.motivo,
          confirmarTraslape,
        })
      } else {
        await programarCita(expedienteId, { ...datos, confirmarTraslape })
      }
      navigate(`/psicologia/expedientes/${expedienteId}`)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as { mensaje?: string; citasEnConflicto?: CitaResumen[] }
        if (data.citasEnConflicto) {
          setConflicto(data.citasEnConflicto)
          setErrorEnvio(data.mensaje ?? 'La cita se traslapa con otra ya programada.')
          return
        }
      }
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  function confirmarDeTodosModos() {
    // getValues() refleja el tipo de entrada del formulario (con defaults opcionales);
    // los valores de tipo/duracionMinutos/confirmarTraslape siempre están definidos porque
    // defaultValues los fija desde el inicio.
    void enviar(getValues() as ProgramarCitaInput, true)
  }

  if (!expedienteId) return null

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold text-gray-800">
        {citaAReprogramar ? 'Reprogramar cita' : 'Programar cita'}
      </h1>

      <form
        onSubmit={handleSubmit((datos) => enviar(datos, false))}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <TextoInput
          type="datetime-local"
          label="Fecha y hora"
          registro={register('fechaHora')}
          error={errors.fechaHora?.message}
        />
        <SelectInput
          label="Modalidad"
          registro={register('modalidad')}
          opciones={OPCIONES_MODALIDAD}
          placeholder="Seleccionar…"
          error={errors.modalidad?.message}
        />
        <TextoInput label="Lugar" registro={register('lugar')} opcional error={errors.lugar?.message} />
        <TextoInput label="Motivo" registro={register('motivo')} error={errors.motivo?.message} />

        {!citaAReprogramar && (
          <>
            <SelectInput
              label="Tipo de cita"
              registro={register('tipo')}
              opciones={OPCIONES_TIPO}
              error={errors.tipo?.message}
            />
            <TextoInput
              type="number"
              label="Duración (minutos)"
              registro={register('duracionMinutos', { valueAsNumber: true })}
              error={errors.duracionMinutos?.message}
            />
          </>
        )}

        {errorEnvio && (
          <div className="space-y-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{errorEnvio}</p>
            {conflicto && (
              <div className="space-y-2">
                {conflicto.map((cita) => (
                  <FilaCita key={cita.id} cita={cita} />
                ))}
                <Button type="button" variante="secondary" cargando={isSubmitting} onClick={confirmarDeTodosModos}>
                  Programar de todos modos
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" cargando={isSubmitting}>
            {citaAReprogramar ? 'Reprogramar' : 'Programar cita'}
          </Button>
        </div>
      </form>
    </div>
  )
}
