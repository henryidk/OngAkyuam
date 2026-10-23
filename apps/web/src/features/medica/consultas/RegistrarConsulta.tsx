import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DIAGNOSTICO_MEDICO_MAX,
  DIAS_PROXIMA_CONSULTA,
  HORARIO_MEDICINA,
  MOTIVO_CONSULTA_MEDICA_MAX,
  PLAN_TRATAMIENTO_MAX,
  RECETA_LABORATORIOS_MAX,
  formatFechaGT,
  hoyGT,
  registrarConsultaMedicaSchema,
  type CampoSignoFormulario,
  type ContextoConsultaMedicaDto,
  type RegistrarConsultaMedicaInput,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { pedirConfirmacionSalida, registrarGuardiaSalida } from '../../../lib/guardiaSalida'
import { useRecurso } from '../../../lib/useRecurso'
import { esConflictoHorario } from '../compartido/useHorario'
import SelectorPersona from '../compartido/SelectorPersona'
import { obtenerContextoConsulta, registrarConsulta } from '../api/medica.api'
import CodigoAtencion from '../compartido/CodigoAtencion'
import { useContextoMedica } from '../compartido/contexto'
import { CLASE_CAMPO, CLASE_SECCION, CLASE_TARJETA } from '../compartido/estilos'
import { diasHabilesSiguientes, fechaCorta, fechaLarga } from '../compartido/fechas'
import { clavePersona, primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA, type OrigenConsulta } from '../rutas'
import CamposSignos from './CamposSignos'
import ConsultasAnteriores from './ConsultasAnteriores'
import DocumentosConsulta from './DocumentosConsulta'
import { useDocumentosConsulta } from './useDocumentosConsulta'
import { leerSignos, signosVacios, type ValoresSignos } from './signosFormulario'

/**
 * Registrar consulta: se abre desde una cita (`?cita=`) o, de forma excepcional, sin cita desde la
 * ficha (`?usuaria=`). `?origen=` decide a dónde se vuelve al guardar o cancelar.
 */
export default function RegistrarConsulta() {
  const [params] = useSearchParams()
  const cita = params.get('cita') ?? undefined
  const usuaria = params.get('usuaria') ?? undefined
  const origen: OrigenConsulta = params.get('origen') === 'ficha' ? 'ficha' : 'consultas'

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
        : [{ etiqueta: 'Consultas', ruta: RUTAS_MEDICA.consultas() }],
  })

  if (error) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta consulta" onReintentar={() => void recargar()} />
  }
  if (!contexto) return <Esqueleto filas={6} />
  // `key`: si cambia la cita o la paciente, el formulario arranca de cero.
  return <FormularioConsulta key={`${contexto.atencionId}:${contexto.cita?.id ?? ''}`} contexto={contexto} origen={origen} />
}

type Pestana = 'actual' | 'anteriores'

function FormularioConsulta({ contexto, origen }: { contexto: ContextoConsultaMedicaDto; origen: OrigenConsulta }) {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarContadores } = useContextoMedica()
  const hoy = hoyGT()

  // Con cita, la persona es la de la cita y no se cambia; sin cita se elige (por defecto la usuaria).
  const [ninoId, setNinoId] = useState<string | null>(contexto.cita ? contexto.cita.ninoId : null)
  const persona = contexto.personas.find((una) => una.ninoId === ninoId) ?? contexto.personas[0]
  const esHijo = persona.ninoId !== null

  // Punto de partida del formulario: se fija al abrir y sirve para saber si hubo cambios.
  const [signosIniciales] = useState(() => signosVacios(persona.ultimaTallaM))
  const [signos, setSignos] = useState<ValoresSignos>(signosIniciales)
  const [motivo, setMotivo] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [plan, setPlan] = useState('')
  const [receta, setReceta] = useState('')
  const [proximaFecha, setProximaFecha] = useState('')
  const [proximaHora, setProximaHora] = useState('09:00')
  const [pestana, setPestana] = useState<Pestana>('actual')
  const [intentado, setIntentado] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [salidaPendiente, setSalidaPendiente] = useState<(() => void) | null>(null)
  const documentos = useDocumentosConsulta(contexto.atencionId)
  // Se calcula una vez al abrir: si la pantalla queda abierta de un día a otro, no cambia bajo el cursor.
  const [diasProxima] = useState(() => diasHabilesSiguientes(DIAS_PROXIMA_CONSULTA))
  // Una clave por contenido: un doble clic o un reintento tras un corte de red no registra dos consultas.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  const hayCambios =
    [motivo, diagnostico, plan, receta, proximaFecha].some((texto) => texto.trim() !== '') ||
    documentos.items.length > 0 ||
    (Object.keys(signos) as CampoSignoFormulario[]).some((clave) => signos[clave] !== signosIniciales[clave])

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

  const rutaVolver = origen === 'ficha' ? RUTAS_MEDICA.paciente(contexto.usuariaId) : RUTAS_MEDICA.consultas()

  function elegirPersona(nuevo: string | null) {
    const anterior = persona
    const siguiente = contexto.personas.find((una) => una.ninoId === nuevo)
    setNinoId(nuevo)
    // La talla precargada es la de la persona: si no se tocó, se cambia por la de la nueva.
    if (siguiente && signos.tallaM === (anterior.ultimaTallaM === null ? '' : String(anterior.ultimaTallaM))) {
      setSignos((actuales) => ({ ...actuales, tallaM: siguiente.ultimaTallaM === null ? '' : String(siguiente.ultimaTallaM) }))
    }
  }

  async function guardar() {
    setIntentado(true)
    setErrorGuardar(null)
    if (documentos.subiendo) return setErrorGuardar('Espera a que terminen de subir los documentos.')
    if (documentos.conError) return setErrorGuardar('Hay un documento que no se subió. Reintenta o quítalo.')
    const lectura = leerSignos(signos)
    if (Object.keys(lectura.errores).length > 0) return setErrorGuardar('Revisa los signos vitales marcados en rojo.')

    const datos: RegistrarConsultaMedicaInput = {
      citaId: contexto.cita?.id ?? null,
      atencionId: contexto.atencionId,
      ninoId: persona.ninoId,
      motivoConsulta: motivo,
      signos: lectura.signos,
      diagnostico,
      planTratamiento: plan,
      recetaLaboratorios: receta,
      proxima: proximaFecha ? `${proximaFecha}T${proximaHora}` : null,
      loteDocumentos: documentos.hayListos ? documentos.lote : null,
    }
    const validacion = registrarConsultaMedicaSchema.safeParse(datos)
    if (!validacion.success) return setErrorGuardar(validacion.error.issues[0]?.message ?? 'Revisa el formulario.')

    const firma = JSON.stringify(datos)
    if (idempotencia.current?.firma !== firma) idempotencia.current = { firma, clave: crypto.randomUUID() }
    setGuardando(true)
    try {
      const registrada = await registrarConsulta(datos, idempotencia.current.clave)
      const proxima = registrada.proximaCita
      const mensaje = `Consulta de ${primerNombre(registrada.personaNombre)} registrada${
        proxima ? ` · próxima: ${fechaCorta(proxima.fecha)}, ${proxima.hora}` : ''
      }`
      const rutaHistoria = RUTAS_MEDICA.historia(registrada.usuariaId, undefined, registrada.consultaId)
      recargarContadores()
      if (origen === 'consultas') {
        navigate(RUTAS_MEDICA.consultas())
        mostrar(mensaje, 'success', { etiqueta: 'Ver en historia clínica', onClick: () => navigate(rutaHistoria) })
      } else {
        navigate(rutaHistoria)
        mostrar(mensaje, 'success')
      }
    } catch (err) {
      setErrorGuardar(
        esConflictoHorario(err)
          ? 'La hora elegida para la próxima consulta ya está ocupada. Elige otra.'
          : extraerMensajeError(err),
      )
      setGuardando(false)
    }
  }

  const subtitulo = contexto.cita
    ? `Cita del ${formatFechaGT(contexto.cita.fecha)} · ${contexto.cita.hora}`
    : `Sin cita · hoy ${formatFechaGT(hoy)}`
  const errorDiagnostico = intentado && diagnostico.trim() === '' ? 'Escribe el diagnóstico.' : null

  return (
    <div className="mx-auto flex max-w-[920px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold text-[#1c2430]">Registrar consulta</h1>
        <p className="text-[13px] text-[#5b6573]">
          <CodigoAtencion codigo={contexto.codigoAtencion} /> · {subtitulo}
        </p>
      </header>

      <section className={`${CLASE_TARJETA} flex flex-col gap-4 px-5 py-[18px]`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={CLASE_SECCION}>Ficha de la paciente</h2>
          <span className="text-xs text-[#9aa4b0]">Datos de Trabajo Social</span>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-3 text-[13.5px]">
          <DatoFicha etiqueta="Nombre">{persona.nombreCompleto}</DatoFicha>
          <DatoFicha etiqueta="Edad">{persona.edad} años</DatoFicha>
          <DatoFicha etiqueta="Fecha de nacimiento">{formatFechaGT(persona.fechaNacimiento)}</DatoFicha>
          <DatoFicha etiqueta="Procedencia">{contexto.procedencia ?? '—'}</DatoFicha>
          <DatoFicha etiqueta="No. de expediente">
            <span className="font-mono">{contexto.expedienteNumero}</span>
          </DatoFicha>
          <DatoFicha etiqueta={esHijo ? 'Teléfono (madre)' : 'Teléfono'}>{contexto.telefono ?? '—'}</DatoFicha>
        </dl>
        {contexto.personas.length > 1 && (
          <SelectorPersona
            personas={contexto.personas}
            ninoId={persona.ninoId}
            onElegir={elegirPersona}
            deshabilitado={contexto.cita !== null || guardando}
          />
        )}
      </section>

      <div role="tablist" className="flex gap-5 border-b border-[#e3e6ea]">
        {(
          [
            ['actual', 'Consulta actual'],
            ['anteriores', `Consultas anteriores (${persona.consultasAnteriores})`],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className={`-mb-px border-b-2 px-0.5 pb-2.5 text-[13.5px] font-medium ${
              pestana === valor ? 'border-[#7346a5] text-[#5b3985]' : 'border-transparent text-[#5b6573] hover:text-[#1c2430]'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'anteriores' ? (
        <ConsultasAnteriores usuariaId={contexto.usuariaId} persona={clavePersona(persona)} nombre={primerNombre(persona.nombreCompleto)} />
      ) : null}

      {/* La consulta actual se oculta (no se desmonta) para no perder lo escrito ni cortar subidas. */}
      <div className={pestana === 'actual' ? 'flex flex-col gap-4' : 'hidden'}>
        <section className={`${CLASE_TARJETA} flex flex-col gap-2 px-5 py-[18px]`}>
          <label htmlFor="motivo" className="text-sm font-semibold text-[#1c2430]">
            Motivo de consulta
          </label>
          <textarea
            id="motivo"
            rows={2}
            maxLength={MOTIVO_CONSULTA_MEDICA_MAX}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Lo que refiere la paciente, con sus palabras"
            className={CLASE_CAMPO}
          />
        </section>

        <CamposSignos
          valores={signos}
          onCambiar={(clave, valor) => setSignos((actuales) => ({ ...actuales, [clave]: valor }))}
          mostrarTodos={intentado}
        />

        <section className={`${CLASE_TARJETA} flex flex-col gap-4 px-5 py-[18px]`}>
          <CampoTexto
            id="diagnostico"
            etiqueta="Diagnóstico"
            obligatorio
            filas={2}
            maximo={DIAGNOSTICO_MEDICO_MAX}
            placeholder="Impresión clínica"
            valor={diagnostico}
            onCambiar={setDiagnostico}
            error={errorDiagnostico}
          />
          <CampoTexto
            id="plan"
            etiqueta="Plan de tratamiento"
            filas={3}
            maximo={PLAN_TRATAMIENTO_MAX}
            placeholder="Indicaciones, cuidados, referencias"
            valor={plan}
            onCambiar={setPlan}
          />
          <CampoTexto
            id="receta"
            etiqueta="Receta y laboratorios"
            filas={3}
            maximo={RECETA_LABORATORIOS_MAX}
            placeholder="Medicamentos con dosis, y laboratorios solicitados"
            valor={receta}
            onCambiar={setReceta}
          />
        </section>

        <DocumentosConsulta documentos={documentos} deshabilitado={guardando} />

        <section className={`${CLASE_TARJETA} flex flex-col gap-2.5 px-5 py-[18px]`}>
          <h2 className="text-sm font-semibold text-[#1c2430]">Próxima consulta</h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Día de la próxima consulta"
              value={proximaFecha}
              onChange={(evento) => setProximaFecha(evento.target.value)}
              className={`${CLASE_CAMPO} w-auto min-w-[240px]`}
            >
              <option value="">Sin próxima consulta por ahora</option>
              {diasProxima.map((fecha) => (
                <option key={fecha} value={fecha}>
                  {fechaLarga(fecha)}
                </option>
              ))}
            </select>
            {proximaFecha && (
              <>
                <select
                  aria-label="Hora de la próxima consulta"
                  value={proximaHora}
                  onChange={(evento) => setProximaHora(evento.target.value)}
                  className={`${CLASE_CAMPO} w-auto font-mono`}
                >
                  {HORARIO_MEDICINA.horas.map((hora) => (
                    <option key={hora} value={hora}>
                      {hora}
                    </option>
                  ))}
                </select>
                <span className="text-[12.5px] text-[#5b6573]">Se agrega a la agenda al guardar.</span>
              </>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
          {errorGuardar && (
            <p role="alert" className="mr-auto text-[13px] text-[#9b2c20]">
              {errorGuardar}
            </p>
          )}
          <button
            type="button"
            disabled={guardando}
            onClick={() => pedirConfirmacionSalida(() => navigate(rutaVolver))}
            className="rounded-md border border-[#d5dadf] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="rounded-md bg-[#7346a5] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#5b3985] disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar consulta'}
          </button>
        </div>
      </div>

      <ConfirmModal
        abierto={salidaPendiente !== null}
        titulo="¿Descartar los cambios?"
        descripcion="La consulta no se ha guardado. Si sales, se pierde lo escrito y los documentos adjuntos."
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

function DatoFicha({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-[#5b6573]">{etiqueta}</dt>
      <dd className="font-medium text-[#1c2430]">{children}</dd>
    </div>
  )
}

interface CampoTextoProps {
  id: string
  etiqueta: string
  obligatorio?: boolean
  filas: number
  maximo: number
  placeholder: string
  valor: string
  onCambiar: (valor: string) => void
  error?: string | null
}

function CampoTexto({ id, etiqueta, obligatorio = false, filas, maximo, placeholder, valor, onCambiar, error }: CampoTextoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-[#1c2430]">
        {etiqueta}
        {obligatorio && (
          <span aria-hidden="true" className="text-[#9b2c20]">
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        id={id}
        rows={filas}
        maxLength={maximo}
        required={obligatorio}
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${CLASE_CAMPO} ${error ? 'border-[#d4574a]' : ''}`}
      />
      {error && (
        <span id={`${id}-error`} className="text-[12px] text-[#9b2c20]">
          {error}
        </span>
      )}
    </div>
  )
}
