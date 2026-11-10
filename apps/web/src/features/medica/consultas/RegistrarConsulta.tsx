import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DURACION_CITA_MEDICA_MIN,
  ETIQUETAS_DURACION_CITA_MEDICA,
  ETIQUETAS_MODALIDAD_CONSULTA_MEDICA,
  MODALIDADES_CONSULTA_MEDICA,
  formatFechaGT,
  hoyGT,
  registrarConsultaMedicaSchema,
  type CampoSignoFormulario,
  type ContextoConsultaMedicaDto,
  type DuracionCitaMedica,
  type ModalidadConsultaMedica,
  type RegistrarConsultaMedicaInput,
} from '@akyuam/shared'
import { useTituloPagina, TituloPrincipal } from '../../../components/TituloPagina'
import AvisoSinProxima from '../../../components/agenda/AvisoSinProxima'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { pedirConfirmacionSalida, registrarGuardiaSalida } from '../../../lib/guardiaSalida'
import { useRecurso } from '../../../lib/useRecurso'
import { esConflictoHorario, MENSAJE_HORARIO_TOMADO } from '../compartido/useHorario'
import SelectorPersonasCita from '../compartido/SelectorPersonasCita'
import { obtenerContextoConsulta, registrarConsulta } from '../api/medica.api'
import CodigoAtencion from '../compartido/CodigoAtencion'
import { useContextoMedica } from '../compartido/contexto'
import { CLASE_TARJETA } from '../compartido/estilos'
import { fechaCorta, fechaLarga, horaMasMinutos } from '../compartido/fechas'
import { clavePersona, listaPrimerosNombres, primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA, type OrigenConsulta } from '../rutas'
import ModalProximaConsulta, { type ProximaElegida } from './ModalProximaConsulta'
import PanelPersona from './PanelPersona'
import PestanasPersonas, { type EstadoPestana } from './PestanasPersonas'
import QueSigueConsulta, { type TipoQueSigueConsulta } from './QueSigueConsulta'
import {
  SIN_DOCUMENTOS,
  estadoInicial,
  pendienteDe,
  tieneCambios,
  type EstadoPersona,
  type ResumenDocumentos,
} from './registroVisita'
import { leerSignos } from './signosFormulario'

/**
 * Registrar consulta: se abre desde una cita (`?cita=`) o, de forma excepcional, sin cita desde la
 * ficha (`?usuaria=`). `?origen=` decide a dónde se vuelve al guardar o cancelar. Una visita puede
 * ser de varias personas (la usuaria y sus hijos/as): cada una tiene su pestaña y su propio
 * registro, y se guardan todas juntas.
 */
export default function RegistrarConsulta() {
  const [params] = useSearchParams()
  const cita = params.get('cita') ?? undefined
  const usuaria = params.get('usuaria') ?? undefined
  const parametroOrigen = params.get('origen')
  const origen: OrigenConsulta = parametroOrigen === 'ficha' || parametroOrigen === 'agenda' ? parametroOrigen : 'consultas'

  const cargar = useCallback(() => {
    if (!cita && !usuaria) return Promise.reject(new Error('Falta indicar la cita o la paciente.'))
    return obtenerContextoConsulta(cita ? { cita } : { usuaria })
  }, [cita, usuaria])
  const { datos: contexto, error, recargar } = useRecurso(cargar)

  useTituloPagina({
    titulo: 'Registrar consulta',
    migas:
      origen === 'ficha' && contexto
        ? [{ etiqueta: contexto.usuariaNombreCompleto, ruta: RUTAS_MEDICA.paciente(contexto.usuariaId) }]
        : origen === 'agenda'
          ? [{ etiqueta: 'Agenda', ruta: RUTAS_MEDICA.agenda(contexto?.cita?.fecha) }]
          : [{ etiqueta: 'Consultas', ruta: RUTAS_MEDICA.consultas() }],
  })

  if (error) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta consulta" onReintentar={() => void recargar()} />
  }
  if (!contexto) return <Esqueleto filas={6} />
  // `key`: si cambia la cita o la paciente, el formulario arranca de cero.
  return <FormularioConsulta key={`${contexto.atencionId}:${contexto.cita?.id ?? ''}`} contexto={contexto} origen={origen} />
}

function FormularioConsulta({ contexto, origen }: { contexto: ContextoConsultaMedicaDto; origen: OrigenConsulta }) {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarContadores } = useContextoMedica()
  const hoy = hoyGT()
  const cita = contexto.cita

  // Con cita: las personas de la cita que aún no tienen su consulta, todas obligatorias (la visita
  // no queda a medias). Sin cita: la médica marca a quiénes atiende (por defecto la usuaria).
  const [marcadas, setMarcadas] = useState<(string | null)[]>([null])
  const elegidas = contexto.personas.filter((persona) =>
    cita ? cita.personas.includes(persona.ninoId) : marcadas.includes(persona.ninoId),
  )
  const personas = elegidas.length > 0 ? elegidas : contexto.personas.slice(0, 1)
  // Sin cita, quien se desmarca conserva lo escrito y sus subidas por si se vuelve a marcar.
  const montadas = cita ? personas : contexto.personas

  // Punto de partida de cada persona: se fija al abrir y sirve para saber si hubo cambios.
  const [inicio] = useState(() =>
    Object.fromEntries(contexto.personas.map((persona) => [clavePersona(persona), estadoInicial(persona)])),
  )
  const [estados, setEstados] = useState<Record<string, EstadoPersona>>(inicio)
  const [documentos, setDocumentos] = useState<Record<string, ResumenDocumentos>>({})
  const [activa, setActiva] = useState(() => clavePersona(personas[0]))
  const claveActiva = personas.some((persona) => clavePersona(persona) === activa) ? activa : clavePersona(personas[0])

  // Una sola para toda la visita; el informe de atención cuenta aparte las telefónicas.
  const [modalidad, setModalidad] = useState<ModalidadConsultaMedica>('PRESENCIAL')
  const duracion = (cita?.duracionMin ?? DURACION_CITA_MEDICA_MIN) as DuracionCitaMedica
  // Qué sigue después de la visita: se elige siempre, nada viene marcado.
  const [queSigue, setQueSigue] = useState<TipoQueSigueConsulta | null>(null)
  const [proxima, setProxima] = useState<ProximaElegida | null>(null)
  const [avisoSinProxima, setAvisoSinProxima] = useState(false)
  const primeraOpcionQueSigue = useRef<HTMLButtonElement>(null)
  const [modalProxima, setModalProxima] = useState(false)
  // Por qué se reabrió el modal: la hora elegida se ocupó mientras se llenaba la consulta.
  const [avisoProxima, setAvisoProxima] = useState<string | null>(null)
  const [intentado, setIntentado] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [salidaPendiente, setSalidaPendiente] = useState<(() => void) | null>(null)
  // Una clave por contenido: un doble clic o un reintento tras un corte de red no registra dos veces.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  const documentosDe = (clave: string) => documentos[clave] ?? SIN_DOCUMENTOS
  const cambiosDe = (clave: string) => tieneCambios(estados[clave], inicio[clave], documentosDe(clave).cantidad)
  const hayCambios = queSigue !== null || modalidad !== 'PRESENCIAL' || montadas.some((persona) => cambiosDe(clavePersona(persona)))

  const estadosPestana: Record<string, EstadoPestana> = {}
  for (const persona of personas) {
    const clave = clavePersona(persona)
    estadosPestana[clave] =
      pendienteDe(estados[clave], documentosDe(clave)) === null
        ? 'lista'
        : intentado
          ? 'falta'
          : cambiosDe(clave)
            ? 'en-curso'
            : 'vacia'
  }

  useEffect(() => {
    if (!hayCambios) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    const quitarGuardia = registrarGuardiaSalida((continuar) => setSalidaPendiente(() => continuar))
    return () => {
      window.removeEventListener('beforeunload', avisar)
      quitarGuardia()
    }
  }, [hayCambios])

  const reportarDocumentos = useCallback((clave: string, resumen: ResumenDocumentos) => {
    setDocumentos((actuales) => ({ ...actuales, [clave]: resumen }))
  }, [])

  function cambiar(clave: string, cambios: Partial<Omit<EstadoPersona, 'signos'>>) {
    setEstados((actuales) => ({ ...actuales, [clave]: { ...actuales[clave], ...cambios } }))
  }

  function cambiarSigno(clave: string, campo: CampoSignoFormulario, valor: string) {
    setEstados((actuales) => ({
      ...actuales,
      [clave]: { ...actuales[clave], signos: { ...actuales[clave].signos, [campo]: valor } },
    }))
  }

  function irA(clave: string) {
    setActiva(clave)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Se vuelve a la pantalla de donde se abrió: desde la Agenda, al día de la cita, para ver quién
  // sigue sin tener que buscarlo de nuevo.
  const rutaVolver =
    origen === 'ficha'
      ? RUTAS_MEDICA.paciente(contexto.usuariaId)
      : origen === 'agenda'
        ? RUTAS_MEDICA.agenda(cita?.fecha)
        : RUTAS_MEDICA.consultas()

  function elegirQueSigue(tipo: TipoQueSigueConsulta) {
    setQueSigue(tipo)
    setErrorGuardar(null)
    // Programar sin día ni hora todavía: se abre de una vez para elegirlos.
    if (tipo === 'PROGRAMAR' && !proxima) abrirProxima()
  }

  function abrirProxima() {
    setAvisoProxima(null)
    setModalProxima(true)
  }

  function irAQueSigue() {
    primeraOpcionQueSigue.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    primeraOpcionQueSigue.current?.focus({ preventScroll: true })
  }

  const errorQueSigue = !intentado
    ? null
    : queSigue === null
      ? 'Elige qué sigue después de esta consulta.'
      : queSigue === 'PROGRAMAR' && !proxima
        ? 'Elige el día y la hora de la próxima consulta.'
        : null

  /** `sinProximaConfirmada`: ya se aceptó el aviso de guardar sin próxima consulta. */
  async function guardar(sinProximaConfirmada = false) {
    setIntentado(true)
    setErrorGuardar(null)
    for (const persona of personas) {
      const clave = clavePersona(persona)
      const falta = pendienteDe(estados[clave], documentosDe(clave))
      if (falta) {
        if (clave !== claveActiva) irA(clave)
        return setErrorGuardar(
          personas.length > 1
            ? `${primerNombre(persona.nombreCompleto)}: ${falta}.`
            : `${falta[0].toUpperCase()}${falta.slice(1)}.`,
        )
      }
    }

    if (queSigue === null || (queSigue === 'PROGRAMAR' && !proxima)) {
      irAQueSigue()
      return setErrorGuardar(queSigue === null ? 'Falta elegir qué sigue.' : 'Falta el día y la hora de la próxima consulta.')
    }
    // Sin próxima es fácil de pasar por alto y deja a la paciente sin fecha: se pide confirmarlo.
    if (queSigue === 'SIN_PROXIMA' && !sinProximaConfirmada) return setAvisoSinProxima(true)

    const programada = queSigue === 'PROGRAMAR' ? proxima : null
    const datos: RegistrarConsultaMedicaInput = {
      citaId: cita?.id ?? null,
      atencionId: contexto.atencionId,
      modalidad,
      registros: personas.map((persona) => {
        const clave = clavePersona(persona)
        const estado = estados[clave]
        const docs = documentos[clave]
        return {
          ninoId: persona.ninoId,
          motivoConsulta: estado.motivo,
          signos: leerSignos(estado.signos).signos,
          diagnostico: estado.diagnostico,
          atencionBrindada: estado.atencion,
          planTratamiento: estado.plan,
          recetaLaboratorios: estado.receta,
          loteDocumentos: docs?.hayListos ? docs.lote : null,
        }
      }),
      proxima: programada
        ? { inicio: `${programada.fecha}T${programada.hora}`, duracionMin: programada.duracionMin, personas: programada.personas }
        : null,
    }
    const validacion = registrarConsultaMedicaSchema.safeParse(datos)
    if (!validacion.success) return setErrorGuardar(validacion.error.issues[0]?.message ?? 'Revisa el formulario.')

    const firma = JSON.stringify(datos)
    if (idempotencia.current?.firma !== firma) idempotencia.current = { firma, clave: crypto.randomUUID() }
    setGuardando(true)
    try {
      const registrada = await registrarConsulta(datos, idempotencia.current.clave)
      const agendada = registrada.proximaCita
      const nombres = listaPrimerosNombres(registrada.consultas.map((consulta) => consulta.personaNombre))
      const mensaje = `${registrada.consultas.length > 1 ? 'Consultas' : 'Consulta'} de ${nombres} ${
        registrada.consultas.length > 1 ? 'registradas' : 'registrada'
      }${agendada ? ` · próxima: ${fechaCorta(agendada.fecha)}, ${agendada.hora}` : ''}`
      const rutaHistoria = RUTAS_MEDICA.historia(registrada.usuariaId, undefined, registrada.consultas[0]?.consultaId)
      recargarContadores()
      if (queSigue === 'ALTA') {
        // El alta nunca es implícita: se abre en la ficha para que la médica la confirme.
        navigate(RUTAS_MEDICA.paciente(registrada.usuariaId, { alta: true }))
        mostrar(mensaje, 'success')
      } else if (origen !== 'ficha') {
        navigate(rutaVolver)
        mostrar(mensaje, 'success', { etiqueta: 'Ver en historia clínica', onClick: () => navigate(rutaHistoria) })
      } else {
        navigate(rutaHistoria)
        mostrar(mensaje, 'success')
      }
    } catch (err) {
      if (esConflictoHorario(err)) {
        // La consulta no se guardó: se vuelve a elegir la próxima con las horas recargadas.
        setErrorGuardar('La hora elegida para la próxima consulta ya está ocupada. Elige otra.')
        setAvisoProxima(MENSAJE_HORARIO_TOMADO)
        setModalProxima(true)
      } else {
        setErrorGuardar(extraerMensajeError(err))
      }
      setGuardando(false)
    }
  }

  const subtitulo = cita
    ? `Cita del ${formatFechaGT(cita.fecha)} · ${cita.hora} – ${horaMasMinutos(cita.hora, duracion)}`
    : `Sin cita · hoy ${formatFechaGT(hoy)}`
  const varias = personas.length > 1
  const atendidasProxima = proxima ? contexto.personas.filter((persona) => proxima.personas.includes(persona.ninoId)) : []

  return (
    <div className="mx-auto flex max-w-[920px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <TituloPrincipal className="text-[22px] font-semibold text-texto">Registrar consulta</TituloPrincipal>
        <p className="text-[13px] text-texto-suave">
          <CodigoAtencion codigo={contexto.codigoAtencion} /> · {subtitulo}
          {varias && ` · ${personas.length} personas`}
        </p>
      </header>

      <section className={`${CLASE_TARJETA} flex flex-wrap items-center justify-between gap-3 px-5 py-3.5`}>
        <h2 id="modalidad-consulta" className="text-sm font-semibold text-texto">
          ¿Cómo fue la consulta?
        </h2>
        <div role="radiogroup" aria-labelledby="modalidad-consulta" className="flex overflow-hidden rounded-md border border-borde-fuerte bg-white">
          {MODALIDADES_CONSULTA_MEDICA.map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={modalidad === opcion}
              disabled={guardando}
              onClick={() => setModalidad(opcion)}
              className={`px-3.5 py-2 text-[13px] font-semibold ${
                modalidad === opcion ? 'bg-brand-600 text-white' : 'bg-white text-texto-cuerpo hover:bg-superficie'
              } disabled:opacity-60`}
            >
              {ETIQUETAS_MODALIDAD_CONSULTA_MEDICA[opcion]}
            </button>
          ))}
        </div>
      </section>

      {!cita && contexto.personas.length > 1 && (
        <section className={`${CLASE_TARJETA} px-5 py-[18px]`}>
          <SelectorPersonasCita
            personas={contexto.personas}
            elegidas={marcadas}
            obligatorias={false}
            onCambiar={setMarcadas}
          />
        </section>
      )}

      {varias && <PestanasPersonas personas={personas} activa={claveActiva} estados={estadosPestana} onElegir={irA} />}

      {montadas.map((persona) => {
        const clave = clavePersona(persona)
        const indice = personas.findIndex((una) => clavePersona(una) === clave)
        const siguiente = indice >= 0 ? personas[indice + 1] : undefined
        return (
          <PanelPersona
            key={clave}
            contexto={contexto}
            persona={persona}
            estado={estados[clave]}
            onCambiar={(cambios) => cambiar(clave, cambios)}
            onSigno={(campo, valor) => cambiarSigno(clave, campo, valor)}
            onDocumentos={reportarDocumentos}
            visible={clave === claveActiva}
            intentado={intentado}
            deshabilitado={guardando}
            siguiente={
              siguiente
                ? { nombre: primerNombre(siguiente.nombreCompleto), ir: () => irA(clavePersona(siguiente)) }
                : null
            }
          />
        )
      })}

      <QueSigueConsulta
        valor={queSigue}
        onElegir={elegirQueSigue}
        error={errorQueSigue}
        deshabilitado={guardando}
        primeraOpcion={primeraOpcionQueSigue}
      >
        {queSigue === 'PROGRAMAR' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde bg-superficie px-4 py-3">
            {proxima ? (
              <div className="min-w-0">
                <p className="text-[13.5px] text-texto">
                  <span className="font-semibold text-brand-700">{fechaLarga(proxima.fecha)}</span>
                  {' · '}
                  <span className="tabular-nums">
                    {proxima.hora} – {horaMasMinutos(proxima.hora, proxima.duracionMin)}
                  </span>
                  {` (${ETIQUETAS_DURACION_CITA_MEDICA[proxima.duracionMin]})`}
                </p>
                {contexto.personas.length > 1 && (
                  <p className="text-[12.5px] text-texto-suave">
                    Para {listaPrimerosNombres(atendidasProxima.map((persona) => persona.nombreCompleto))}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-texto-suave">Falta elegir el día y la hora.</p>
            )}
            <button
              type="button"
              disabled={guardando}
              onClick={abrirProxima}
              className="flex-none rounded-md border border-borde-fuerte bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"
            >
              {proxima ? 'Cambiar' : 'Elegir día y hora'}
            </button>
          </div>
        )}
      </QueSigueConsulta>

      {modalProxima && (
        <ModalProximaConsulta
          personas={contexto.personas}
          usuariaNombreCompleto={contexto.usuariaNombreCompleto}
          inicial={
            proxima ?? { duracionMin: duracion, personas: personas.map((persona) => persona.ninoId) }
          }
          aviso={avisoProxima}
          onCerrar={() => setModalProxima(false)}
          onElegir={(elegida) => {
            setProxima(elegida)
            setModalProxima(false)
            setAvisoProxima(null)
            setErrorGuardar(null)
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
        {errorGuardar && (
          <p role="alert" className="mr-auto text-[13px] text-estado-error">
            {errorGuardar}
          </p>
        )}
        <button
          type="button"
          disabled={guardando}
          onClick={() => pedirConfirmacionSalida(() => navigate(rutaVolver))}
          className="rounded-md border border-borde-fuerte bg-white px-4 py-2.5 text-[13.5px] font-medium text-texto hover:bg-superficie disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar()}
          className="rounded-md bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : varias ? `Guardar ${personas.length} consultas` : 'Guardar consulta'}
        </button>
      </div>

      <AvisoSinProxima
        abierto={avisoSinProxima}
        que="consulta"
        persona={listaPrimerosNombres(personas.map((persona) => persona.nombreCompleto))}
        varias={varias}
        dondeQueda={`Pacientes › "Sin próxima consulta"`}
        guardarLabel="Guardar sin próxima consulta"
        onVolver={() => setAvisoSinProxima(false)}
        onProgramar={() => {
          setAvisoSinProxima(false)
          elegirQueSigue('PROGRAMAR')
        }}
        onGuardar={() => {
          setAvisoSinProxima(false)
          void guardar(true)
        }}
      />

      <ConfirmModal
        abierto={salidaPendiente !== null}
        titulo="¿Descartar los cambios?"
        descripcion={`${varias ? 'Las consultas no se han guardado' : 'La consulta no se ha guardado'}. Si sales, se pierde lo escrito y los documentos adjuntos.`}
        confirmarLabel="Descartar"
        cancelarLabel="Seguir editando"
        peligro
        onConfirmar={() => {
          const continuar = salidaPendiente
          setSalidaPendiente(null)
          continuar?.()
        }}
        onCancelar={() => setSalidaPendiente(null)}
      />
    </div>
  )
}
