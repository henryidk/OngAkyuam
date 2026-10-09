import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA,
  fechaCalendarioGT,
  formatFechaGT,
  formatInstanteGT,
  hoyGT,
  minutosDelDiaGT,
  type CitaRefDto,
  type ProcesoPsicologiaDetalle,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import Tabs from '../../../components/ui/Tabs'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { fechaDeInstante } from '../../../lib/formato'
import { useRecurso } from '../../../lib/useRecurso'
import {
  listarCitasAgenda,
  listarProcesosParaAgendar,
  listarSesionesProceso,
  obtenerProceso,
} from '../api/psicologia.api'
import ConfirmarNoAsistio from '../citas/ConfirmarNoAsistio'
import ModalProgramarCita, { type DestinoCita } from '../citas/ModalProgramarCita'
import BarraEtapa from '../compartido/BarraEtapa'
import { useContextoPsicologia } from '../compartido/contexto'
import EtiquetaEtapa from '../compartido/EtiquetaEtapa'
import { horaDeInstante, horaDeMinutos } from '../compartido/horas'
import { usePaginasCursor } from '../compartido/usePaginasCursor'
import { RUTAS_PSICOLOGIA } from '../rutas'
import type { ContextoDetalle, PropsModalProceso } from './contextoDetalle'
import ModalCerrar from './ModalCerrar'
import PanelResumen from './PanelResumen'
import PanelVisibilidad from './PanelVisibilidad'
import CodigoProceso from '../compartido/CodigoProceso'

const CLASE_BANNER = 'rounded-xl border px-5 py-3.5 text-sm'
const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'
const CLASE_BOTON_OSCURO = 'rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-60'

/** La cita a programar o mover, con el día en que arranca el campo de fecha del modal. */
interface CitaPorGuardar {
  destino: DestinoCita
  fechaInicial: string
  horaInicial?: string
}

function BannerCerrado({ proceso }: { proceso: ProcesoPsicologiaDetalle }) {
  return (
    <div className={`${CLASE_BANNER} border-green-200 bg-green-50 text-gray-800`}>
      <p className="font-semibold text-green-800">
        Proceso cerrado
        {proceso.fechaCierre && ` · ${fechaDeInstante(proceso.fechaCierre)}`}
        {proceso.motivoCierre && ` · ${ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA[proceso.motivoCierre]}`}
      </p>
      {proceso.resumenCierre && <p className="mt-1 whitespace-pre-wrap">{proceso.resumenCierre}</p>}
      <p className="mt-1 text-xs text-gray-600">Si la usuaria necesita volver, se abre un proceso nuevo desde su ficha.</p>
    </div>
  )
}

/** "08/10/2026 · 09:00", en hora de Guatemala. */
function fechaYHora(cita: CitaRefDto): string {
  return `${formatFechaGT(fechaCalendarioGT(new Date(cita.fechaHora)))} · ${horaDeInstante(cita.fechaHora)}`
}

interface AvisoSinRegistrarProps {
  cita: CitaRefDto
  onNoAsistio: (cita: CitaRefDto) => void
}

/** Una cita que ya pasó y nadie registró: desde aquí se anota la sesión o la inasistencia. */
function AvisoSinRegistrar({ cita, onNoAsistio }: AvisoSinRegistrarProps) {
  return (
    <div className={`${CLASE_BANNER} flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 text-gray-800`}>
      <p className="min-w-[220px] flex-1">
        <span className="font-semibold text-amber-900 tabular-nums">Cita del {fechaYHora(cita)} sin registrar.</span>{' '}
        Anota la sesión o marca que la persona no asistió.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)}
          className="inline-flex items-center rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Registrar sesión
        </Link>
        <Button variante="secondary" onClick={() => onNoAsistio(cita)}>
          Marcar no asistió
        </Button>
      </div>
    </div>
  )
}

export default function DetalleProceso() {
  const { procesoId } = useParams<{ procesoId: string }>()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoPsicologia()
  const [hoy] = useState(() => hoyGT())

  const cargar = useCallback(() => obtenerProceso(procesoId!), [procesoId])
  const { datos: proceso, error, recargar } = useRecurso(cargar)
  const cargarSesiones = useCallback((cursor?: string) => listarSesionesProceso(procesoId!, cursor), [procesoId])
  const paginas = usePaginasCursor(procesoId!, cargarSesiones)

  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useSearchParams()
  // Quien eligió "Cerrar proceso" al registrar una sesión llega con el modal ya abierto.
  const [cerrando, setCerrando] = useState(() => busqueda.get('cerrar') === '1')
  useEffect(() => {
    if (!busqueda.has('cerrar')) return
    // Se quita de la URL para que recargar la página no vuelva a abrir el modal.
    const sinCerrar = new URLSearchParams(busqueda)
    sinCerrar.delete('cerrar')
    setBusqueda(sinCerrar, { replace: true })
  }, [busqueda, setBusqueda])
  const [cita, setCita] = useState<CitaPorGuardar | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [aMarcar, setAMarcar] = useState<CitaRefDto | null>(null)

  useTituloPagina({
    titulo: proceso?.codigo ?? 'Proceso',
    migas: [{ etiqueta: 'Procesos', ruta: RUTAS_PSICOLOGIA.procesos() }],
  })

  const { recargar: recargarSesiones } = paginas
  const refrescar = useCallback(() => {
    void recargar()
    void recargarSesiones()
    recargarResumen()
  }, [recargar, recargarSesiones, recargarResumen])

  const contexto = useMemo<ContextoDetalle | null>(
    () =>
      proceso
        ? {
            proceso,
            sesiones: {
              items: paginas.items,
              error: paginas.error?.mensaje ?? null,
              hayMas: paginas.hayMas,
              cargandoMas: paginas.cargandoMas,
              errorMas: paginas.errorMas,
              cargarMas: () => void paginas.cargarMas(),
              recargar: () => void recargarSesiones(),
            },
          }
        : null,
    [proceso, paginas, recargarSesiones],
  )

  if (error && !proceso) {
    return (
      <ErrorVista
        mensaje={error.mensaje}
        sinPermiso={error.sinPermiso}
        recurso="este proceso"
        onReintentar={() => void recargar()}
      />
    )
  }
  if (!proceso || !contexto) return <Esqueleto />

  const acciones = proceso.accionesDisponibles
  const puedeProgramar = acciones.includes('PROGRAMAR_CITA')
  const proxima = proceso.proximaCita
  const diaProxima = proxima ? fechaCalendarioGT(new Date(proxima.fechaHora)) : null
  // Solo quien puede registrar ve lo pendiente de registro; el servidor ya lo manda vacío si no.
  const sinRegistrar = acciones.includes('REGISTRAR_SESION') ? proceso.citasSinRegistrar : []
  // Con una cita por registrar lo pendiente es esa sesión, no agendar otra.
  const avisarSinProxima = !proxima && puedeProgramar && sinRegistrar.length === 0
  // Un solo botón primario a la vista: si un aviso ya lleva la acción principal, el del encabezado cede.
  const encabezadoCede = avisarSinProxima || sinRegistrar.length > 0
  const sesiones = paginas.items
  const todasCargadas = sesiones !== null && !paginas.hayMas
  const documentos = sesiones?.filter((sesion) => sesion.documento).length ?? 0

  // El modal de la agenda necesita datos que el detalle no trae (a quién se puede atender, la
  // cita completa): se piden al pulsar, así también se confirma que la acción sigue vigente.
  async function preparar(obtener: () => Promise<CitaPorGuardar | null>, mensajeSiFalta: string) {
    if (preparando) return
    setPreparando(true)
    try {
      const lista = await obtener()
      if (lista) {
        setCita(lista)
      } else {
        mostrar(mensajeSiFalta, 'error')
        refrescar()
      }
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    } finally {
      setPreparando(false)
    }
  }

  function abrirProgramar() {
    void preparar(async () => {
      const mio = (await listarProcesosParaAgendar()).find((uno) => uno.procesoId === proceso!.id)
      return mio ? { destino: { tipo: 'PROCESO', procesos: [mio], procesoId: mio.procesoId }, fechaInicial: hoy } : null
    }, 'Este proceso ya no admite citas nuevas.')
  }

  // Una sesión que ocurrió sin cita previa: se anota cuándo fue y se pasa directo a registrarla.
  function abrirSinCita() {
    void preparar(async () => {
      const mio = (await listarProcesosParaAgendar()).find((uno) => uno.procesoId === proceso!.id)
      return mio
        ? {
            destino: { tipo: 'PROCESO', procesos: [mio], procesoId: mio.procesoId, sinCita: true },
            fechaInicial: hoy,
            horaInicial: horaDeMinutos(minutosDelDiaGT(new Date())),
          }
        : null
    }, 'Este proceso ya no admite sesiones nuevas.')
  }

  function abrirReprogramar() {
    if (!proxima || !diaProxima) return
    void preparar(async () => {
      const delDia = await listarCitasAgenda({ desde: diaProxima, hasta: diaProxima })
      const laCita = delDia.find((una) => una.id === proxima.id && una.estado === 'PROGRAMADA')
      return laCita ? { destino: { tipo: 'MOVER', cita: laCita }, fechaInicial: diaProxima } : null
    }, 'La cita cambió. Se actualizó el proceso.')
  }

  const propsModal: PropsModalProceso = {
    proceso,
    onCerrar: () => setCerrando(false),
    onHecho: (mensaje) => {
      setCerrando(false)
      mostrar(mensaje)
      refrescar()
    },
    onConflicto: refrescar,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className={`${CLASE_TARJETA} px-6 pt-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CodigoProceso codigo={proceso.codigo} className="text-gray-700" />
              <EtiquetaEtapa etapa={proceso.etapa} />
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-pretty text-gray-900">
              Proceso psicológico · {proceso.usuariaNombreCompleto}
            </h2>
            <p className="text-sm text-gray-600">
              Expediente {proceso.expedienteNumero} · Inicio {fechaDeInstante(proceso.fechaInicio)} · {proceso.psicologa} ·{' '}
              <Link to={RUTAS_PSICOLOGIA.usuaria(proceso.usuariaId)} className="font-medium text-brand-700 hover:underline">
                Ver ficha de la usuaria →
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {puedeProgramar && (
              <Button
                variante={encabezadoCede ? 'secondary' : 'primary'}
                tamano="md"
                cargando={preparando}
                onClick={abrirProgramar}
              >
                Programar cita
              </Button>
            )}
            {puedeProgramar && acciones.includes('REGISTRAR_SESION') && (
              <Button variante="secondary" tamano="md" disabled={preparando} onClick={abrirSinCita}>
                Registrar sesión sin cita
              </Button>
            )}
            {acciones.includes('CERRAR') && (
              <Button variante="secondary" tamano="md" onClick={() => setCerrando(true)}>
                Cerrar proceso
              </Button>
            )}
          </div>
        </div>
        <div className="mt-5">
          <BarraEtapa
            etapa={proceso.etapa}
            fechaInicio={proceso.fechaInicio}
            fechaCierre={proceso.fechaCierre}
            huboSesiones={proceso.sesionesAtendidas > 0}
          />
        </div>
        <Tabs
          className="mt-4"
          items={[
            { to: RUTAS_PSICOLOGIA.proceso(proceso.id), etiqueta: `Sesiones (${proceso.sesionesAtendidas})`, fin: true },
            {
              to: RUTAS_PSICOLOGIA.documentosProceso(proceso.id),
              etiqueta: todasCargadas ? `Documentos (${documentos})` : 'Documentos',
            },
          ]}
        />
      </header>

      {proceso.soloLectura && (
        <div className={`${CLASE_BANNER} border-gray-200 bg-gray-50 text-gray-800`}>
          <p className="font-semibold text-gray-900">Proceso de {proceso.psicologa} · solo lectura</p>
          <p className="mt-1 text-xs text-gray-600">
            Lo llevó otra psicóloga y ya está cerrado. Puedes leer sus sesiones, notas y documentos para dar
            continuidad a la atención; no se puede modificar. Cada consulta queda registrada.
          </p>
        </div>
      )}

      {proceso.psicologasAnteriores.length > 0 && (
        <div className={`${CLASE_BANNER} border-amber-200 bg-amber-50/60 text-gray-800`}>
          <p className="font-semibold text-gray-900">Este proceso cambió de psicóloga</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
            {proceso.psicologasAnteriores.map((anterior) => (
              <li key={anterior.hasta}>
                Lo llevó {anterior.nombre} hasta el {fechaDeInstante(anterior.hasta)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {proceso.etapa === 'CIERRE' && <BannerCerrado proceso={proceso} />}

      {sinRegistrar.map((pendiente) => (
        <AvisoSinRegistrar key={pendiente.id} cita={pendiente} onNoAsistio={setAMarcar} />
      ))}

      {proxima && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-gray-900 px-5 py-4 text-white">
          <div className="min-w-[220px] flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-300">Próxima cita</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {formatInstanteGT(proxima.fechaHora)}
              {diaProxima === hoy && ' · hoy'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {diaProxima === hoy && acciones.includes('REGISTRAR_SESION') && (
              <Link
                to={RUTAS_PSICOLOGIA.registrarConsulta(proxima.id)}
                className={`${CLASE_BOTON_OSCURO} bg-white text-gray-900 hover:bg-gray-100`}
              >
                Registrar sesión
              </Link>
            )}
            <button
              type="button"
              onClick={abrirReprogramar}
              disabled={preparando}
              className={`${CLASE_BOTON_OSCURO} border border-gray-500 text-white hover:bg-gray-800`}
            >
              Reprogramar
            </button>
          </div>
        </div>
      )}

      {avisarSinProxima && (
        <div className={`${CLASE_BANNER} flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 text-gray-800`}>
          <p className="min-w-[220px] flex-1">
            <span className="font-semibold text-amber-900">Sin próxima cita.</span> El proceso sigue activo pero no
            tiene siguiente fecha.
          </p>
          <Button variante="acento" cargando={preparando} onClick={abrirProgramar}>
            Programar cita
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Outlet context={contexto} />
        </div>

        <aside className="space-y-4">
          <PanelResumen
            proceso={proceso}
            inasistencias={todasCargadas ? sesiones.filter((sesion) => sesion.estado === 'NO_ASISTIO').length : null}
          />
          {!proceso.soloLectura && <PanelVisibilidad proceso={proceso} onCambio={refrescar} />}
        </aside>
      </div>

      {cerrando && acciones.includes('CERRAR') && <ModalCerrar {...propsModal} />}
      <ConfirmarNoAsistio
        cita={aMarcar && { id: aMarcar.id, descripcion: `${proceso.usuariaNombreCompleto} · cita del ${fechaYHora(aMarcar)}` }}
        onCancelar={() => setAMarcar(null)}
        onIntento={(marcada) => {
          if (marcada) {
            setAMarcar(null)
            mostrar('Inasistencia registrada')
          }
          // También si falló: lo más probable es que otra pestaña ya la haya registrado.
          refrescar()
        }}
      />
      {cita && (
        <ModalProgramarCita
          destino={cita.destino}
          fechaInicial={cita.fechaInicial}
          horaInicial={cita.horaInicial}
          onCerrar={() => setCita(null)}
          onGuardada={(_fecha, mensaje, citaId) => {
            if (cita.destino.tipo === 'PROCESO' && cita.destino.sinCita) {
              navigate(RUTAS_PSICOLOGIA.registrarConsulta(citaId))
              return
            }
            setCita(null)
            mostrar(mensaje)
            refrescar()
          }}
        />
      )}
    </div>
  )
}
