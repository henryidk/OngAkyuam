import axios from 'axios'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  ATENCION_BRINDADA_MAX,
  DIAGNOSTICO_MAX,
  ENFOQUE_TERAPEUTICO_MAX,
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  RESULTADOS_SESION_PSICOLOGICA,
  fechaCalendarioGT,
  formatInstanteGT,
  hoyGT,
  registroConsultaSchema,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type ConsultaRegistradaDto,
  type DocumentoCitaDto,
  type DuracionCitaPsicologica,
  type EstadoAtencionPsicologica,
  type RegistroConsultaInput,
  type SesionSinCitaInput,
  type SiguientePasoSesion,
} from '@akyuam/shared'
import SelectorDuracion from '../../../../components/agenda/SelectorDuracion'
import TextareaInput from '../../../../components/form/TextareaInput'
import Button from '../../../../components/ui/Button'
import ConfirmModal from '../../../../components/ui/ConfirmModal'
import { useToast } from '../../../../components/ui/Toast'
import { extraerMensajeError } from '../../../../lib/errors'
import { useEnlaceProtegido } from '../../../../lib/guardiaSalida'
import { useAvisoSalida } from '../../../../lib/useAvisoSalida'
import { registrarConsulta, registrarSesionSinCita } from '../../api/psicologia.api'
import CodigoProceso from '../../compartido/CodigoProceso'
import { useContextoPsicologia } from '../../compartido/contexto'
import { horaDeInstante } from '../../compartido/horas'
import { RUTAS_PSICOLOGIA, type OrigenSesion } from '../../rutas'
import ElegirClinica from '../ElegirClinica'
import HojaEvolucion from '../HojaEvolucion'
import ModalProximaCita, { type ProximaCitaElegida } from '../ModalProximaCita'
import QueSigue, { type EstadoQueSigue } from '../QueSigue'
import AvisoSinProxima from '../../../../components/agenda/AvisoSinProxima'
import { VOLVER_A, rutaDeOrigen } from './origen'

/** El contador del enfoque solo aparece cuando falta poco para el límite. */
const AVISO_LIMITE_ENFOQUE = ENFOQUE_TERAPEUTICO_MAX - 200

export type ValoresRegistro = z.input<typeof registroConsultaSchema>

interface CitaDelRegistro {
  id: string
  fechaHora: string
  duracionMinutos: number
}

export interface ContextoRegistro {
  /** null = "Atender ahora": el proceso todavía no existe, nace al registrar esta sesión. */
  procesoId: string | null
  codigoProceso: string
  procesoEtapa: EstadoAtencionPsicologica
  /** A quién se atiende: la usuaria o su hija/o. */
  persona: string
  usuariaNombreCompleto: string
  esHijo: boolean
  /** null = sesión sin cita: la cita nace al registrarla, con la hora del servidor. */
  cita: CitaDelRegistro | null
  /** Sesión ya registrada que se corrige: sin "¿Qué sigue?". */
  yaRegistrada: boolean
  valores: ValoresRegistro
  documento: DocumentoCitaDto | null
  /** Duración con la que se propone la próxima cita (y la sesión sin cita). */
  duracion: DuracionCitaPsicologica
  /**
   * Cómo nace la sesión sin cita. Sin ella, en el proceso existente (`procesoId`); "Atender
   * ahora" la crea abriendo además el proceso.
   */
  crearSesion?: (datos: SesionSinCitaInput, clave: string) => Promise<ConsultaRegistradaDto>
}

interface FormularioRegistroProps {
  contexto: ContextoRegistro
  origen: OrigenSesion
}

/**
 * Registrar una sesión: en qué quedó, las notas clínicas, la Hoja de evolución escaneada y qué
 * sigue con el proceso. Sirve para una cita existente y para la sesión sin cita (que se crea al
 * registrarla). Nada se guarda hasta pulsar "Registrar sesión" (ni en el servidor ni en el
 * navegador): al salir con cambios se avisa que se pierde lo escrito.
 * Si la persona llegó antes de la fecha agendada, se pide confirmar y la cita queda con la fecha y
 * la hora reales de la atención.
 * Al guardar se vuelve al origen; si se eligió "Cerrar proceso" se va siempre al proceso, porque
 * el cierre se confirma ahí.
 */
export default function FormularioRegistro({ contexto, origen }: FormularioRegistroProps) {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoPsicologia()
  const protegerEnlace = useEnlaceProtegido()

  const sinCita = contexto.cita === null
  const cita = contexto.cita
  // La de la sesión sin cita, en cuanto el servidor la crea (un reintento ya no la crea otra vez).
  const citaRef = useRef<CitaDelRegistro | null>(contexto.cita)
  // Una por formulario: un reintento del registro no crea dos sesiones.
  const claveSinCita = useRef(crypto.randomUUID())
  const postIntentado = useRef(false)
  const [duracion, setDuracion] = useState<DuracionCitaPsicologica>(contexto.duracion)

  const [documento, setDocumento] = useState<DocumentoCitaDto | null>(contexto.documento)
  const [siguiente, setSiguiente] = useState<EstadoQueSigue>(() => ({
    // Nada marcado: qué sigue se decide siempre de forma explícita.
    tipo: null,
    fecha: '',
    // La próxima cita suele ser a la misma hora que esta.
    hora: horaDeInstante(contexto.cita?.fechaHora ?? new Date().toISOString()),
    duracion: contexto.duracion,
  }))
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [guardandoFinal, setGuardandoFinal] = useState(false)
  // Registro esperando que la psicóloga confirme un aviso: que vino antes o que no queda próxima cita.
  const [porConfirmar, setPorConfirmar] = useState<{ datos: RegistroConsultaInput; aviso: 'ADELANTO' | 'SIN_PROXIMA' } | null>(
    null,
  )
  // Se intentó registrar sin elegir qué sigue (o sin día y hora de la próxima cita).
  const [errorQueSigue, setErrorQueSigue] = useState<string | null>(null)
  const [modalProxima, setModalProxima] = useState(false)
  const primeraOpcionQueSigue = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ValoresRegistro, any, RegistroConsultaInput>({
    resolver: zodResolver(registroConsultaSchema),
    defaultValues: contexto.valores,
  })
  const valores = watch()
  const estado = valores.estado
  const largoEnfoque = valores.enfoqueTerapeutico?.length ?? 0

  const { yaRegistrada } = contexto
  // La persona vino antes de la fecha agendada: al registrarla atendida, queda con la de hoy.
  const [ahora] = useState(() => Date.now())
  const citaFutura = !yaRegistrada && cita !== null && new Date(cita.fechaHora).getTime() > ahora
  const adelantada = citaFutura && estado === 'ATENDIDA'

  /** La sesión sin cita se crea por POST; una cita existente (o ya creada) se registra por PUT. */
  async function enviar(registro: RegistroConsultaInput): Promise<ConsultaRegistradaDto> {
    const actual = citaRef.current
    if (actual) return registrarConsulta(actual.id, registro)
    const reintento = postIntentado.current
    postIntentado.current = true
    const datosSesion = { duracionMinutos: duracion, registro }
    const creada = contexto.crearSesion
      ? await contexto.crearSesion(datosSesion, claveSinCita.current)
      : await registrarSesionSinCita(contexto.procesoId!, datosSesion, claveSinCita.current)
    const nueva = { id: creada.cita.id, fechaHora: creada.cita.fechaHora, duracionMinutos: creada.cita.duracionMinutos }
    citaRef.current = nueva
    // "Atrás" en el navegador abre la sesión ya creada, no una sesión sin cita nueva.
    window.history.replaceState(window.history.state, '', RUTAS_PSICOLOGIA.registrarConsulta(nueva.id, origen))
    // Con la misma clave, el servidor devuelve la respuesta del primer intento (que pudo crear la
    // cita aunque aquí no llegara la respuesta), con el texto de entonces: lo de ahora se guarda
    // por PUT, sin volver a programar la próxima cita, que ya quedó en ese primer intento.
    if (reintento) return registrarConsulta(nueva.id, { ...registro, siguiente: undefined })
    return creada
  }

  const aviso = useAvisoSalida(isDirty && !guardandoFinal)

  const diaSesion = cita ? fechaCalendarioGT(new Date(cita.fechaHora)) : hoyGT()
  const hoy = hoyGT()
  // Atendida antes de tiempo, la sesión pasa a hoy: la próxima cita se cuenta desde hoy.
  const diaReal = adelantada ? hoy : diaSesion
  const diaBase = diaReal > hoy ? diaReal : hoy
  const rutaProceso = contexto.procesoId ? RUTAS_PSICOLOGIA.proceso(contexto.procesoId) : null
  const rutaVolver = rutaDeOrigen(origen, contexto.procesoId, diaReal)
  const primeraSesion = contexto.procesoEtapa === 'INICIO' && estado === 'ATENDIDA'

  function cambiarSiguiente(valor: EstadoQueSigue) {
    setSiguiente(valor)
    // El aviso de traslape era sobre la fecha anterior: al tocar un dato deja de valer.
    setConflicto(null)
    setErrorEnvio(null)
    setErrorQueSigue(null)
  }

  function elegirQueSigue(tipo: SiguientePasoSesion['tipo']) {
    cambiarSiguiente({ ...siguiente, tipo })
    // Programar sin día ni hora todavía: se eligen en el modal, sin pasar por otro botón.
    if (tipo === 'PROGRAMAR' && !siguiente.fecha) setModalProxima(true)
  }

  function usarProxima(elegida: ProximaCitaElegida) {
    setModalProxima(false)
    const misma =
      elegida.fecha === siguiente.fecha && elegida.hora === siguiente.hora && elegida.duracion === siguiente.duracion
    // Dejar la misma hora después del aviso de traslape es decidir que va así: el aviso se queda
    // y el siguiente registro la confirma.
    if (misma && conflicto) return
    cambiarSiguiente({ ...siguiente, ...elegida })
  }

  /** Lo que falta en "¿Qué sigue?" para poder registrar, o null si está completo. */
  function faltaEnQueSigue(): string | null {
    if (yaRegistrada) return null
    if (siguiente.tipo === null) return 'Elige qué sigue después de esta sesión.'
    if (siguiente.tipo === 'PROGRAMAR' && (!siguiente.fecha || !siguiente.hora)) {
      return 'Falta elegir el día y la hora de la próxima cita.'
    }
    return null
  }

  function irAQueSigue() {
    primeraOpcionQueSigue.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    primeraOpcionQueSigue.current?.focus({ preventScroll: true })
  }

  function armarSiguiente(elegido: EstadoQueSigue): SiguientePasoSesion | null {
    if (elegido.tipo === null) return null
    if (elegido.tipo !== 'PROGRAMAR') return { tipo: elegido.tipo }
    if (!elegido.fecha || !elegido.hora) return null
    return {
      tipo: 'PROGRAMAR',
      fechaHora: `${elegido.fecha}T${elegido.hora}`,
      duracionMinutos: elegido.duracion,
      confirmarTraslape: conflicto !== null,
    }
  }

  /** Revisa qué sigue y pide los avisos que falten antes de guardar, uno a la vez. */
  function revisar(datos: RegistroConsultaInput, confirmados: { adelanto?: boolean; sinProxima?: boolean } = {}) {
    const falta = faltaEnQueSigue()
    if (falta) {
      setErrorQueSigue(falta)
      irAQueSigue()
      return
    }
    if (adelantada && !confirmados.adelanto) return setPorConfirmar({ datos, aviso: 'ADELANTO' })
    // Sin próxima cita es fácil de pasar por alto y deja a la persona sin fecha: se pide confirmarlo.
    if (!yaRegistrada && siguiente.tipo === 'NINGUNA' && !confirmados.sinProxima) {
      return setPorConfirmar({ datos, aviso: 'SIN_PROXIMA' })
    }
    void finalizar(datos)
  }

  function alEnviar(datos: RegistroConsultaInput) {
    revisar(datos)
  }

  async function finalizar(datos: RegistroConsultaInput) {
    if (guardandoFinal) return
    let paso: SiguientePasoSesion | undefined
    if (!yaRegistrada) {
      const armado = armarSiguiente(siguiente)
      if (!armado) return
      paso = armado
    }

    setErrorEnvio(null)
    setGuardandoFinal(true)
    try {
      const registrada = await enviar({ ...datos, siguiente: paso })
      recargarResumen()

      let mensaje = `Sesión registrada · ${ETIQUETAS_ESTADO_CITA_PSICOLOGICA[registrada.cita.estado]}`
      if (registrada.pasoASeguimiento) mensaje += ' · el proceso pasó a Seguimiento'
      if (registrada.proximaCita) mensaje += ` · próxima cita ${formatInstanteGT(registrada.proximaCita.fechaHora)}`
      const rutaSesion = RUTAS_PSICOLOGIA.proceso(registrada.procesoId, registrada.cita.id, paso?.tipo === 'CERRAR')
      // El cierre nunca es implícito: se abre su modal en el proceso para que la psicóloga lo confirme.
      if (origen !== 'proceso' && paso?.tipo !== 'CERRAR') {
        navigate(rutaVolver)
        mostrar(mensaje, 'success', { etiqueta: 'Ver en el proceso', onClick: () => navigate(rutaSesion) })
      } else {
        navigate(rutaSesion)
        mostrar(mensaje)
      }
    } catch (err) {
      const cuerpo = axios.isAxiosError(err) ? (err.response?.data as Partial<ConflictoTraslapeCita> | undefined) : undefined
      if (cuerpo?.codigo === CODIGO_TRASLAPE_CITA && cuerpo.detalle) {
        setConflicto(cuerpo.detalle.citas)
        // Se vuelve a abrir el selector con el aviso: ahí se cambia la hora o se deja a propósito.
        setModalProxima(true)
      } else {
        setErrorEnvio(extraerMensajeError(err))
      }
      setGuardandoFinal(false)
    }
  }

  let etiquetaGuardar = yaRegistrada ? 'Guardar cambios' : 'Registrar sesión'
  if (!yaRegistrada && siguiente.tipo === 'CERRAR') etiquetaGuardar = 'Registrar y cerrar proceso…'
  if (conflicto) etiquetaGuardar = 'Registrar de todos modos'

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h2 className="text-[22px] font-semibold tracking-tight text-gray-900">
          {sinCita ? (contexto.procesoId ? 'Sesión sin cita' : 'Primera sesión') : 'Registrar sesión'} ·{' '}
          {contexto.persona}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {contexto.esHijo && <>Hija/o de {contexto.usuariaNombreCompleto} · </>}
          {rutaProceso ? (
            <Link
              to={rutaProceso}
              onClick={(evento) => protegerEnlace(evento, rutaProceso)}
              className="text-brand-700 hover:underline"
            >
              <CodigoProceso codigo={contexto.codigoProceso} />
            </Link>
          ) : (
            <>
              Exp. {contexto.codigoProceso} · su proceso se abre al registrar
            </>
          )}{' '}
          ·{' '}
          {cita ? (
            <>
              {formatInstanteGT(cita.fechaHora)} · {cita.duracionMinutos} min
            </>
          ) : (
            'Ahora, con la fecha y hora en que se registre'
          )}
        </p>
      </header>

      {citaFutura && cita && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Todavía no es la fecha de esta cita ({formatInstanteGT(cita.fechaHora)}). Si la persona vino antes, regístrala
          aquí: quedará con la fecha y la hora de hoy.
        </p>
      )}

      <form
        onSubmit={(evento) => {
          // Se marca aunque falten otros campos, para que se vea todo lo pendiente de una vez.
          setErrorQueSigue(faltaEnQueSigue())
          void handleSubmit(alEnviar)(evento)
        }}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        {cita === null && (
          <div className="max-w-sm">
            <SelectorDuracion opciones={DURACIONES_CITA_PSICOLOGICA_MINUTOS} duracion={duracion} onCambiar={setDuracion} />
          </div>
        )}

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          {/* La sesión sin cita es siempre una sesión atendida: si no vino, no hubo sesión. */}
          {!sinCita && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-gray-800">Resultado</legend>
              <div className="flex flex-wrap gap-2">
                {/* Antes de la fecha no hay inasistencia: o vino antes, o la cita se cancela. */}
                {RESULTADOS_SESION_PSICOLOGICA.filter((r) => !(citaFutura && r === 'NO_ASISTIO')).map((resultado) => {
                  const elegido = estado === resultado
                  return (
                    <button
                      key={resultado}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => setValue('estado', resultado, { shouldValidate: false, shouldDirty: true })}
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
          )}
          {estado === 'ATENDIDA' && (
            <ElegirClinica
              valor={valores.clinica ?? null}
              onCambio={(elegida) => setValue('clinica', elegida, { shouldValidate: true, shouldDirty: true })}
              error={errors.clinica?.message}
            />
          )}
        </div>

        {primeraSesion && !yaRegistrada && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Es la primera sesión atendida de este proceso: al guardar pasa de <strong>Inicio</strong> a{' '}
            <strong>Seguimiento</strong>.
          </p>
        )}

        {estado === 'ATENDIDA' ? (
          <>
            {/* Primero lo obligatorio (atención brindada y diagnóstico), después lo opcional. */}
            <div className="space-y-4">
              <TextareaInput
                label="Atención brindada"
                registro={register('atencionBrindada')}
                rows={2}
                maxLength={ATENCION_BRINDADA_MAX}
                ayuda="Resumen breve de la atención; sale en el reporte de población de Trabajo Social."
                error={errors.atencionBrindada?.message}
              />
              <TextareaInput
                label="Diagnóstico"
                registro={register('diagnostico')}
                rows={2}
                maxLength={DIAGNOSTICO_MAX}
                className="field-sizing-content min-h-16"
                ayuda="Sale en el reporte de personas atendidas."
                error={errors.diagnostico?.message}
              />
              <TextareaInput label="Temas abordados" registro={register('temas')} opcional error={errors.temas?.message} />
              <TextareaInput label="Intervención" registro={register('intervencion')} opcional error={errors.intervencion?.message} />
              <div>
                <TextareaInput
                  label="Enfoque terapéutico"
                  registro={register('enfoqueTerapeutico')}
                  rows={2}
                  maxLength={ENFOQUE_TERAPEUTICO_MAX}
                  className="field-sizing-content min-h-16"
                  opcional
                  ayuda="Por ejemplo: cognitivo-conductual, sistémico, centrado en el trauma."
                  error={errors.enfoqueTerapeutico?.message}
                />
                {largoEnfoque >= AVISO_LIMITE_ENFOQUE && (
                  <p aria-live="polite" className="mt-1 text-right text-xs text-gray-500 tabular-nums">
                    {largoEnfoque} / {ENFOQUE_TERAPEUTICO_MAX}
                  </p>
                )}
              </div>
              <TextareaInput label="Acuerdos" registro={register('acuerdos')} opcional error={errors.acuerdos?.message} />
              <TextareaInput label="Observaciones" registro={register('observaciones')} opcional error={errors.observaciones?.message} />
            </div>
            {cita ? (
              <HojaEvolucion citaId={cita.id} documento={documento} onSubido={setDocumento} />
            ) : (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600">
                La Hoja de evolución se sube después de registrar: abre la sesión desde el proceso y
                adjúntala ahí.
              </p>
            )}
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
          <QueSigue
            valor={siguiente}
            onElegir={elegirQueSigue}
            onElegirHorario={() => setModalProxima(true)}
            conflicto={conflicto}
            error={errorQueSigue}
            deshabilitado={guardandoFinal}
            primeraOpcion={primeraOpcionQueSigue}
          />
        )}

        {errorEnvio && (
          <p role="alert" className="text-sm text-red-600">
            {errorEnvio}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-gray-100 pt-4">
          <Link
            to={rutaVolver}
            onClick={(evento) => protegerEnlace(evento, rutaVolver)}
            className="mr-auto text-sm font-medium text-gray-600 hover:underline"
          >
            {VOLVER_A[origen]}
          </Link>
          <Button type="submit" tamano="md" cargando={guardandoFinal}>
            {etiquetaGuardar}
          </Button>
        </div>
      </form>

      <ConfirmModal
        abierto={aviso.salidaPendiente}
        titulo="¿Descartar los cambios?"
        descripcion={
          yaRegistrada
            ? 'Los cambios a esta sesión todavía no se guardan. Si sales ahora, se pierden.'
            : 'La sesión todavía no se registra. Si sales ahora, perderás lo escrito.'
        }
        confirmarLabel="Descartar"
        cancelarLabel="Seguir editando"
        peligro
        onConfirmar={aviso.descartar}
        onCancelar={aviso.quedarse}
      />

      <AvisoSinProxima
        abierto={porConfirmar?.aviso === 'SIN_PROXIMA'}
        que="cita"
        persona={contexto.persona}
        dondeQueda={`"Sin próxima cita"`}
        guardarLabel="Registrar sin próxima cita"
        onVolver={() => setPorConfirmar(null)}
        onProgramar={() => {
          setPorConfirmar(null)
          elegirQueSigue('PROGRAMAR')
          irAQueSigue()
        }}
        onGuardar={() => {
          const pendiente = porConfirmar
          setPorConfirmar(null)
          if (pendiente) revisar(pendiente.datos, { adelanto: true, sinProxima: true })
        }}
      />

      {modalProxima && (
        <ModalProximaCita
          inicial={{ fecha: siguiente.fecha, hora: siguiente.hora, duracion: siguiente.duracion }}
          diaBase={diaBase}
          conflicto={conflicto}
          onCerrar={() => setModalProxima(false)}
          onElegir={usarProxima}
        />
      )}

      <ConfirmModal
        abierto={porConfirmar?.aviso === 'ADELANTO'}
        titulo="Todavía no es la fecha de esta cita"
        descripcion={`La cita estaba agendada para ${cita ? formatInstanteGT(cita.fechaHora) : ''}. ¿Deseas registrar la consulta ahora? Quedará con la fecha y la hora de hoy.`}
        confirmarLabel="Registrar ahora"
        cancelarLabel="Volver"
        onConfirmar={() => {
          const pendiente = porConfirmar
          setPorConfirmar(null)
          if (pendiente) revisar(pendiente.datos, { adelanto: true })
        }}
        onCancelar={() => setPorConfirmar(null)}
      />
    </div>
  )
}
