import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  fechaCalendarioGT,
  programarCitaSchema,
  type CitaResumen,
  type ProgramarCitaInput,
  type TipoCitaPsicologica,
} from '@akyuam/shared'
import SelectInput from '../../../components/form/SelectInput'
import TextoInput from '../../../components/form/TextoInput'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerResumenExpediente, programarCita, reprogramarCita } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'
import FilaCita from './FilaCita'

const OPCIONES_MODALIDAD = MODALIDADES_CITA.map((modalidad) => ({
  value: modalidad,
  label: ETIQUETAS_MODALIDAD_CITA[modalidad],
}))
const OPCIONES_TIPO = TIPOS_CITA_PSICOLOGICA.map((tipo) => ({
  value: tipo,
  label: ETIQUETAS_TIPO_CITA_PSICOLOGICA[tipo],
}))

/** Hora a la que se abre el formulario cuando el origen solo aportó el día. */
const HORA_INICIAL_POR_DEFECTO = '09:00'

function esTipoValido(valor: string | null): valor is TipoCitaPsicologica {
  return valor !== null && (TIPOS_CITA_PSICOLOGICA as readonly string[]).includes(valor)
}

export default function ProgramarCita() {
  const [searchParams] = useSearchParams()
  const expedienteId = searchParams.get('expediente')
  const citaAReprogramar = searchParams.get('reprograma')
  const tipoPrecargado = searchParams.get('tipo')
  const fechaPrecargada = searchParams.get('fecha')
  const navigate = useNavigate()

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof programarCitaSchema>, any, ProgramarCitaInput>({
    resolver: zodResolver(programarCitaSchema),
    defaultValues: {
      fechaHora: fechaPrecargada ? `${fechaPrecargada}T${HORA_INICIAL_POR_DEFECTO}` : '',
      modalidad: undefined,
      lugar: '',
      motivo: '',
      tipo: esTipoValido(tipoPrecargado) ? tipoPrecargado : 'SEGUIMIENTO',
      duracionMinutos: DURACION_CITA_PSICOLOGICA_MINUTOS_DEFAULT,
      confirmarTraslape: false,
    },
  })

  // El tipo se deriva del proceso, no se asume: un expediente sin citas va a primera atención.
  // Si el origen ya lo sabía (`?tipo=`), se respeta y no se consulta.
  useEffect(() => {
    if (!expedienteId || citaAReprogramar || esTipoValido(tipoPrecargado)) return
    let vigente = true
    void obtenerResumenExpediente(expedienteId)
      .then((resumen) => {
        if (vigente) setValue('tipo', resumen.totalCitas === 0 ? 'PRIMERA_ATENCION' : 'SEGUIMIENTO')
      })
      .catch(() => {
        // El valor por defecto del formulario sigue siendo válido; no se interrumpe al usuario.
      })
    return () => {
      vigente = false
    }
  }, [expedienteId, citaAReprogramar, tipoPrecargado, setValue])

  /** Tras guardar se vuelve al calendario, abierto en el día de la cita: es donde se ve el efecto. */
  function volverAlDiaDeLaCita(fechaHoraLocal: string) {
    const dia = fechaHoraLocal.slice(0, 10) || fechaCalendarioGT(new Date())
    navigate(RUTAS_PSICOLOGIA.agenda(dia))
  }

  async function enviar(datos: ProgramarCitaInput, confirmarTraslape: boolean) {
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
        if (!expedienteId) return
        await programarCita(expedienteId, { ...datos, confirmarTraslape })
      }
      volverAlDiaDeLaCita(datos.fechaHora)
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

  if (!expedienteId && !citaAReprogramar) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-lg font-semibold text-gray-800">Programar cita</h1>
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Elige primero el expediente desde la agenda o desde el expediente de la usuaria — el buscador
          integrado llega en una fase posterior.
        </p>
        <Button variante="secondary" onClick={() => navigate(RUTAS_PSICOLOGIA.agenda())}>
          Volver a la agenda
        </Button>
      </div>
    )
  }

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
