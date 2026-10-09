import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  RESULTADOS_SESION_PSICOLOGICA,
  fechaCalendarioGT,
  formatInstanteGT,
  hoyGT,
  registroConsultaSchema,
  type CitaPsicologicaDetalle,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type DocumentoCitaDto,
  type RegistroConsultaInput,
  type ResultadoSesionPsicologica,
  type SiguientePasoSesion,
} from '@akyuam/shared'
import TextareaInput from '../../../components/form/TextareaInput'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerDetalleCita, registrarConsulta } from '../api/psicologia.api'
import { useContextoPsicologia } from '../compartido/contexto'
import { horaDeInstante } from '../compartido/horas'
import { RUTAS_PSICOLOGIA } from '../rutas'
import FormatoGeneral from './FormatoGeneral'
import QueSigue, { type EstadoQueSigue } from './QueSigue'
import CodigoProceso from '../compartido/CodigoProceso'

function esResultado(estado: string): estado is ResultadoSesionPsicologica {
  return (RESULTADOS_SESION_PSICOLOGICA as readonly string[]).includes(estado)
}

function queSigueInicial(cita: CitaPsicologicaDetalle): EstadoQueSigue {
  const duracion =
    DURACIONES_CITA_PSICOLOGICA_MINUTOS.find((minutos) => minutos === cita.duracionMinutos) ??
    DURACIONES_CITA_PSICOLOGICA_MINUTOS[0]
  // La próxima cita suele ser a la misma hora que esta.
  return { tipo: 'NINGUNA', fecha: '', hora: horaDeInstante(cita.fechaHora), duracion }
}

/**
 * Registrar una sesión: en qué quedó la cita, las notas clínicas, el Formato General escaneado
 * y qué sigue con el proceso. El borrador se guarda en el servidor, no en el navegador.
 */
export default function RegistroConsulta() {
  const { citaId } = useParams<{ citaId: string }>()
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoPsicologia()

  const cargar = useCallback(() => obtenerDetalleCita(citaId!), [citaId])
  const { datos: cita, error, recargar } = useRecurso(cargar)

  const [documento, setDocumento] = useState<DocumentoCitaDto | null>(null)
  const [siguiente, setSiguiente] = useState<EstadoQueSigue | null>(null)
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<'borrador' | 'final' | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
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

  useTituloPagina({
    titulo: 'Registrar sesión',
    migas: cita
      ? [
          { etiqueta: 'Procesos', ruta: RUTAS_PSICOLOGIA.procesos() },
          { etiqueta: cita.procesoCodigo, ruta: RUTAS_PSICOLOGIA.proceso(cita.procesoId) },
        ]
      : [{ etiqueta: 'Procesos', ruta: RUTAS_PSICOLOGIA.procesos() }],
  })

  // Lo que ya estaba guardado (un borrador, o una sesión que se corrige) entra al formulario.
  useEffect(() => {
    if (!cita) return
    reset({
      estado: esResultado(cita.estado) ? cita.estado : 'ATENDIDA',
      temas: cita.temas ?? '',
      intervencion: cita.intervencion ?? '',
      recomendaciones: cita.recomendaciones ?? '',
      acuerdos: cita.acuerdos ?? '',
      observaciones: cita.observaciones ?? '',
      motivoNoAsistencia: cita.motivoNoAsistencia ?? '',
      borrador: false,
    })
    setDocumento(cita.documento)
    setSiguiente(queSigueInicial(cita))
    setConflicto(null)
  }, [cita, reset])

  if (error && !cita) {
    return (
      <ErrorVista
        mensaje={error.mensaje}
        sinPermiso={error.sinPermiso}
        recurso="esta cita"
        onReintentar={() => void recargar()}
      />
    )
  }
  if (!cita || !siguiente) return <Esqueleto />

  const persona = cita.ninoNombreCompleto ?? cita.usuariaNombreCompleto
  const rutaProceso = RUTAS_PSICOLOGIA.proceso(cita.procesoId)

  if (cita.procesoEtapa === 'CIERRE' || cita.estado === 'REPROGRAMADA') {
    return (
      <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Esta sesión ya no se puede registrar</h2>
        <p className="text-sm text-gray-600">
          {cita.procesoEtapa === 'CIERRE'
            ? 'El proceso está cerrado. Si la usuaria necesita volver, se le abre un proceso nuevo desde su ficha.'
            : 'La cita se movió a otra fecha: registra la sesión desde la cita nueva.'}
        </p>
        <Link to={rutaProceso} className="inline-block text-sm font-medium text-brand-700 hover:underline">
          Ir al proceso {cita.procesoCodigo} →
        </Link>
      </div>
    )
  }

  // Una sesión ya registrada se puede corregir, pero "¿Qué sigue?" se decidió en su momento.
  const yaRegistrada = esResultado(cita.estado) && !cita.borrador
  const primeraSesion = cita.procesoEtapa === 'INICIO' && estado === 'ATENDIDA'
  const diaCita = fechaCalendarioGT(new Date(cita.fechaHora))
  const hoy = hoyGT()
  const diaBase = diaCita > hoy ? diaCita : hoy

  function cambiarSiguiente(valor: EstadoQueSigue) {
    setSiguiente(valor)
    // El aviso de traslape era sobre la fecha anterior: al tocar un dato deja de valer.
    setConflicto(null)
    setErrorEnvio(null)
  }

  function armarSiguiente(elegido: EstadoQueSigue): SiguientePasoSesion | null {
    if (elegido.tipo !== 'PROGRAMAR') return { tipo: elegido.tipo }
    if (!elegido.fecha || !elegido.hora) return null
    return {
      tipo: 'PROGRAMAR',
      fechaHora: `${elegido.fecha}T${elegido.hora}`,
      duracionMinutos: elegido.duracion,
      confirmarTraslape: conflicto !== null,
    }
  }

  async function guardarBorrador() {
    if (!citaId || guardando) return
    setErrorEnvio(null)
    setGuardando('borrador')
    try {
      await registrarConsulta(citaId, { ...getValues(), borrador: true })
      mostrar('Borrador guardado')
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    } finally {
      setGuardando(null)
    }
  }

  async function finalizar(datos: RegistroConsultaInput) {
    if (!citaId || !siguiente || guardando) return
    let paso: SiguientePasoSesion | undefined
    if (!yaRegistrada) {
      const armado = armarSiguiente(siguiente)
      if (!armado) {
        setErrorEnvio('Indica la fecha y la hora de la próxima cita, o elige "Decidir después".')
        return
      }
      paso = armado
    }

    setErrorEnvio(null)
    setGuardando('final')
    try {
      const registrada = await registrarConsulta(citaId, { ...datos, borrador: false, siguiente: paso })
      recargarResumen()

      let mensaje = `Sesión registrada · ${ETIQUETAS_ESTADO_CITA_PSICOLOGICA[registrada.cita.estado]}`
      if (registrada.pasoASeguimiento) mensaje += ' · el proceso pasó a Seguimiento'
      if (registrada.proximaCita) mensaje += ` · próxima cita ${formatInstanteGT(registrada.proximaCita.fechaHora)}`
      mostrar(mensaje)
      // El cierre nunca es implícito: se abre su modal para que la psicóloga lo confirme.
      navigate(RUTAS_PSICOLOGIA.proceso(registrada.procesoId, citaId, paso?.tipo === 'CERRAR'))
    } catch (err) {
      const cuerpo = axios.isAxiosError(err) ? (err.response?.data as Partial<ConflictoTraslapeCita> | undefined) : undefined
      if (cuerpo?.codigo === CODIGO_TRASLAPE_CITA && cuerpo.detalle) {
        setConflicto(cuerpo.detalle.citas)
      } else {
        setErrorEnvio(extraerMensajeError(err))
      }
    } finally {
      setGuardando(null)
    }
  }

  let etiquetaGuardar = yaRegistrada ? 'Guardar cambios' : 'Guardar sesión'
  if (!yaRegistrada && siguiente.tipo === 'CERRAR') etiquetaGuardar = 'Guardar y cerrar proceso…'
  if (conflicto) etiquetaGuardar = 'Guardar de todos modos'

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h2 className="text-[22px] font-semibold tracking-tight text-gray-900">Registrar sesión · {persona}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {cita.ninoNombreCompleto !== null && <>Hija/o de {cita.usuariaNombreCompleto} · </>}
          <Link to={rutaProceso} className="text-brand-700 hover:underline">
            <CodigoProceso codigo={cita.procesoCodigo} />
          </Link>{' '}
          · {formatInstanteGT(cita.fechaHora)} · {cita.duracionMinutos} min
        </p>
      </header>

      <form
        onSubmit={(evento) => void handleSubmit(finalizar)(evento)}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-gray-800">Resultado</legend>
          <div className="flex flex-wrap gap-2">
            {RESULTADOS_SESION_PSICOLOGICA.map((resultado) => {
              const elegido = estado === resultado
              return (
                <button
                  key={resultado}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => setValue('estado', resultado, { shouldValidate: false })}
                  className={`rounded-md border px-4 py-2 text-sm font-medium ${
                    elegido
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {ETIQUETAS_ESTADO_CITA_PSICOLOGICA[resultado]}
                </button>
              )
            })}
          </div>
          {errors.estado?.message && <p className="text-sm text-red-600">{errors.estado.message}</p>}
        </fieldset>

        {primeraSesion && !yaRegistrada && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Es la primera sesión atendida de este proceso: al guardar pasa de <strong>Inicio</strong> a{' '}
            <strong>Seguimiento</strong>.
          </p>
        )}

        {estado === 'ATENDIDA' ? (
          <>
            <div className="space-y-4">
              <TextareaInput label="Temas abordados" registro={register('temas')} opcional error={errors.temas?.message} />
              <TextareaInput label="Intervención" registro={register('intervencion')} opcional error={errors.intervencion?.message} />
              <TextareaInput label="Recomendaciones" registro={register('recomendaciones')} opcional error={errors.recomendaciones?.message} />
              <TextareaInput label="Acuerdos" registro={register('acuerdos')} opcional error={errors.acuerdos?.message} />
              <TextareaInput label="Observaciones" registro={register('observaciones')} opcional error={errors.observaciones?.message} />
            </div>
            <FormatoGeneral citaId={cita.id} documento={documento} onSubido={setDocumento} />
          </>
        ) : (
          <TextareaInput
            label={estado === 'NO_ASISTIO' ? 'Motivo de la inasistencia' : 'Motivo de la cancelación'}
            registro={register('motivoNoAsistencia')}
            ayuda="Si no se sabe, anótalo así."
            error={errors.motivoNoAsistencia?.message}
          />
        )}

        {!yaRegistrada && (
          <QueSigue valor={siguiente} onCambio={cambiarSiguiente} diaBase={diaBase} conflicto={conflicto} />
        )}

        {errorEnvio && (
          <p role="alert" className="text-sm text-red-600">
            {errorEnvio}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <Link to={rutaProceso} className="mr-auto text-sm font-medium text-gray-600 hover:underline">
            Volver al proceso
          </Link>
          {!yaRegistrada && (
            <Button
              type="button"
              variante="secondary"
              tamano="md"
              onClick={() => void guardarBorrador()}
              cargando={guardando === 'borrador'}
              disabled={guardando === 'final'}
            >
              Guardar borrador
            </Button>
          )}
          <Button type="submit" tamano="md" cargando={guardando === 'final'} disabled={guardando === 'borrador'}>
            {etiquetaGuardar}
          </Button>
        </div>
      </form>
    </div>
  )
}
