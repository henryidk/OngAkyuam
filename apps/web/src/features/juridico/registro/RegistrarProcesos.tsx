import axios from 'axios'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  crearProcesosEnLoteSchema,
  hoyGT,
  type ErrorDuplicadosLote,
  type PersonalDto,
  type ProcesoActivoPorTipo,
  type RegistroContextoDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { crearProcesosEnLote, obtenerContextoRegistro } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { iniciales } from '../compartido/formato'
import { usePersonalJuridico } from '../compartido/usePersonalJuridico'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import PasoAsignacion from './PasoAsignacion'
import PasoSeleccion from './PasoSeleccion'
import ResumenLateral from './ResumenLateral'
import { aProcesosDeLote, estadoInicial, registroReducer } from './registroReducer'

const PASOS = ['Seleccionar procesos', 'Asignar y confirmar'] as const

function duplicadosDe(error: unknown): ProcesoActivoPorTipo[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const cuerpo = error.response.data as Partial<ErrorDuplicadosLote> | undefined
  return cuerpo?.codigo === 'DUPLICADOS_ACTIVOS' ? (cuerpo.detalle?.duplicados ?? []) : null
}

interface AsistenteProps {
  contexto: RegistroContextoDto
  abogadas: PersonalDto[]
  procuradoras: PersonalDto[]
}

function Asistente({ contexto, abogadas, procuradoras }: AsistenteProps) {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoJuridico()
  const [estado, dispatch] = useReducer(registroReducer, null, () => estadoInicial(contexto.sugeridos, hoyGT()))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicados, setDuplicados] = useState<ProcesoActivoPorTipo[] | null>(null)
  const creado = useRef(false)

  // La clave identifica "este contenido": un reintento por fallo de red la reutiliza (el backend
  // devuelve lo ya creado); cualquier cambio en el formulario genera una nueva.
  const clave = useRef(crypto.randomUUID())
  useEffect(() => {
    clave.current = crypto.randomUUID()
  }, [estado])

  // Aviso del navegador al cerrar o recargar con una selección sin guardar.
  const haySeleccion = estado.filas.length > 0
  useEffect(() => {
    if (!haySeleccion) return
    const avisar = (evento: BeforeUnloadEvent) => {
      if (!creado.current) evento.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [haySeleccion])

  const seleccionados = estado.filas.map((fila) => fila.tipo)
  const salida = RUTAS_JURIDICO.usuaria(contexto.usuaria.id)

  async function crear(confirmaDuplicados: boolean) {
    const validado = crearProcesosEnLoteSchema.safeParse({
      referidoId: contexto.referencia?.referidoId ?? null,
      procesos: aProcesosDeLote(estado.filas),
      confirmaDuplicados,
    })
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Revise los datos de los procesos')
      return
    }
    // Confirmar los duplicados es otra petición distinta: necesita su propia clave.
    if (confirmaDuplicados) clave.current = crypto.randomUUID()
    setError(null)
    setEnviando(true)
    try {
      const { procesos, usuariaId } = await crearProcesosEnLote(contexto.expediente.id, validado.data, clave.current)
      creado.current = true
      recargarResumen()
      mostrar(
        procesos.length === 1
          ? '1 proceso creado. Ábralo para adjuntar documentos'
          : `${procesos.length} procesos creados. Abra cada uno para adjuntar documentos`,
      )
      navigate(RUTAS_JURIDICO.usuaria(usuariaId), { replace: true })
    } catch (err) {
      const repetidos = duplicadosDe(err)
      if (repetidos) setDuplicados(repetidos)
      else {
        setDuplicados(null)
        setError(extraerMensajeError(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  function salir() {
    creado.current = true
    navigate(salida)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        >
          {iniciales(contexto.usuaria.nombreCompleto)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-gray-900">{contexto.usuaria.nombreCompleto}</p>
          <p className="text-xs text-gray-500 tabular-nums">
            {contexto.usuaria.dpi ? `DPI ${contexto.usuaria.dpi}` : 'Sin DPI registrado'} · Expediente{' '}
            {contexto.expediente.numero}
          </p>
        </div>
        <ol className="flex items-center gap-2 text-sm">
          {PASOS.map((etiqueta, indice) => {
            const numero = indice + 1
            const actual = estado.paso === numero
            return (
              <li
                key={etiqueta}
                aria-current={actual ? 'step' : undefined}
                className={`flex items-center gap-2 ${actual ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    estado.paso >= numero ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {numero}
                </span>
                {etiqueta}
                {numero < PASOS.length && <span aria-hidden="true" className="mx-1 h-px w-6 bg-gray-300" />}
              </li>
            )
          })}
        </ol>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {estado.paso === 1 ? (
            <PasoSeleccion
              seleccionados={seleccionados}
              sugeridos={contexto.sugeridos}
              activosPorTipo={contexto.activosPorTipo}
              onAlternar={(tipo) => dispatch({ type: 'TOGGLE_TIPO', tipo, hoy: hoyGT() })}
            />
          ) : (
            <PasoAsignacion
              filas={estado.filas}
              abogadas={abogadas}
              procuradoras={procuradoras}
              procesosVinculables={contexto.procesosVinculables}
              onAsignar={(tipo, campo, valor) => dispatch({ type: 'ASIGNAR', tipo, campo, valor })}
              onCopiarPrimero={() => dispatch({ type: 'COPIAR_PRIMERO_A_TODOS' })}
              onQuitar={(tipo) => dispatch({ type: 'TOGGLE_TIPO', tipo, hoy: hoyGT() })}
              onAgregarOtro={() => dispatch({ type: 'IR_A_PASO', paso: 1 })}
            />
          )}

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
            <Button
              variante="secondary"
              tamano="md"
              onClick={() => (haySeleccion ? setConfirmandoSalida(true) : salir())}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <div className="flex gap-2">
              {estado.paso === 2 && (
                <Button
                  variante="secondary"
                  tamano="md"
                  onClick={() => dispatch({ type: 'IR_A_PASO', paso: 1 })}
                  disabled={enviando}
                >
                  ← Volver
                </Button>
              )}
              {estado.paso === 1 ? (
                <Button tamano="md" disabled={!haySeleccion} onClick={() => dispatch({ type: 'IR_A_PASO', paso: 2 })}>
                  Continuar →
                </Button>
              ) : (
                <Button tamano="md" cargando={enviando && !duplicados} onClick={() => void crear(false)}>
                  {estado.filas.length === 1 ? 'Crear 1 proceso' : `Crear ${estado.filas.length} procesos`}
                </Button>
              )}
            </div>
          </div>
        </div>

        <ResumenLateral contexto={contexto} seleccionados={seleccionados} />
      </div>

      <ConfirmModal
        abierto={confirmandoSalida}
        titulo="¿Salir sin registrar?"
        descripcion="Los procesos seleccionados no se han creado y la selección se perderá."
        confirmarLabel="Salir sin registrar"
        peligro
        onConfirmar={salir}
        onCancelar={() => setConfirmandoSalida(false)}
      />

      <ConfirmModal
        abierto={duplicados !== null}
        titulo="La usuaria ya tiene procesos activos de este tipo"
        descripcion="Confirme solo si de verdad se trata de un proceso nuevo y distinto."
        confirmarLabel="Crear de todos modos"
        cargando={enviando}
        error={duplicados ? error : null}
        onConfirmar={() => void crear(true)}
        onCancelar={() => setDuplicados(null)}
      >
        <ul className="space-y-1 text-sm text-gray-800">
          {duplicados?.map((duplicado) => (
            <li key={`${duplicado.tipo}-${duplicado.codigo}`}>
              <span className="font-mono text-xs text-gray-600">{duplicado.codigo}</span> ·{' '}
              {ETIQUETAS_TIPO_PROCESO_JURIDICO[duplicado.tipo]}
            </li>
          ))}
        </ul>
      </ConfirmModal>
    </div>
  )
}

/** Asistente de 2 pasos: `/juridico/procesos/registrar?expediente=…&referido=…`. */
export default function RegistrarProcesos() {
  const [searchParams] = useSearchParams()
  const expedienteId = searchParams.get('expediente')
  const cargar = useCallback(
    () => (expedienteId ? obtenerContextoRegistro(expedienteId) : Promise.reject(new Error('Falta el expediente'))),
    [expedienteId],
  )
  const { datos: contexto, error, recargar } = useRecurso(cargar)
  const personal = usePersonalJuridico()

  useTituloPagina({
    titulo: 'Registrar procesos',
    migas: contexto
      ? [
          { etiqueta: 'Expedientes', ruta: RUTAS_JURIDICO.expedientes() },
          { etiqueta: contexto.usuaria.nombreCompleto, ruta: RUTAS_JURIDICO.usuaria(contexto.usuaria.id) },
        ]
      : [{ etiqueta: 'Área de atención', ruta: RUTAS_JURIDICO.bandeja() }],
  })

  if (!expedienteId) return <Navigate to={RUTAS_JURIDICO.bandeja()} replace />
  if (error) {
    return (
      <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="este expediente" onReintentar={() => void recargar()} />
    )
  }
  if (!contexto || personal.cargando) return <Esqueleto />

  return (
    <>
      {personal.error && (
        <p className="mx-auto mb-4 max-w-6xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-gray-800">
          No se pudo cargar la lista de abogadas y procuradoras: los procesos se crearán sin asignar.{' '}
          <Link to={RUTAS_JURIDICO.bandeja()} className="font-medium text-brand-700 hover:underline">
            Volver
          </Link>
        </p>
      )}
      {/* key: otro expediente = otro asistente, con su propia selección inicial. */}
      <Asistente key={contexto.expediente.id} contexto={contexto} abogadas={personal.abogadas} procuradoras={personal.procuradoras} />
    </>
  )
}

/** Compatibilidad con la URL anterior `/juridico/:id/casos`. */
export function RedirigirARegistro() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? RUTAS_JURIDICO.registrar({ expedienteId: id }) : RUTAS_JURIDICO.bandeja()} replace />
}
