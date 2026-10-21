import { useCallback, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import {
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_MOTIVO_ABANDONO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoDetalle,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { useToast } from '../../../components/ui/Toast'
import { obtenerProceso, reactivarProceso } from '../api/juridico.api'
import { admiteAudiencias, casoDesdeProceso, type ModalAudiencia } from '../audiencias/caso'
import ModalesAudiencia from '../audiencias/ModalesAudiencia'
import ModalNumeroJudicial from '../compartido/ModalNumeroJudicial'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { fechaDeInstante } from '../compartido/formato'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import CabeceraProceso from './CabeceraProceso'
import type { ContextoDetalle, PropsModalProceso } from './contextoDetalle'
import ModalAbandono from './ModalAbandono'
import ModalActuacion from './ModalActuacion'
import ModalFinalizar from './ModalFinalizar'
import ModalSuspender from './ModalSuspender'
import PanelCierre from './PanelCierre'
import PanelDatos from './PanelDatos'
import { useEnvio } from './useEnvio'

type ModalAbierto = 'actuacion' | 'finalizar' | 'suspender' | 'abandono' | 'reactivar' | 'numeroJudicial'

const CLASE_BANNER = 'rounded-xl border px-5 py-3.5 text-sm'
const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

function Banners({ proceso }: { proceso: ProcesoDetalle }) {
  const { abandonoVigente: abandono, suspensionVigente: suspension } = proceso
  return (
    <>
      {abandono && (
        <div className={`${CLASE_BANNER} border-red-200 bg-red-50 text-gray-800`}>
          <p className="font-semibold text-red-800">
            Caso abandonado · {formatFechaGT(abandono.fecha)} · {ETIQUETAS_MOTIVO_ABANDONO[abandono.motivoCatalogo]}
          </p>
          {abandono.observaciones && <p className="mt-1">{abandono.observaciones}</p>}
          <p className="mt-1 text-xs text-gray-600">
            Último contacto: {abandono.ultimoContacto ? formatFechaGT(abandono.ultimoContacto) : 'no registrado'} ·{' '}
            {abandono.intentosContacto} intentos de contacto ·{' '}
            {abandono.notificadoATs ? 'Notificado a Trabajo Social' : 'Sin notificar a Trabajo Social'}
          </p>
        </div>
      )}
      {suspension && (
        <div className={`${CLASE_BANNER} border-amber-200 bg-amber-50 text-gray-800`}>
          <p className="font-semibold text-[#8a5a14]">Suspendido desde {fechaDeInstante(suspension.desde)}</p>
          <p className="mt-1">{suspension.motivo}</p>
        </div>
      )}
      {proceso.formaFinalizacion && (
        <div className={`${CLASE_BANNER} border-green-200 bg-green-50 text-gray-800`}>
          <p className="font-semibold text-green-800">
            Finalizado por {ETIQUETAS_FORMA_FINALIZACION[proceso.formaFinalizacion]}
            {proceso.fechaCierre && ` · ${formatFechaGT(proceso.fechaCierre)}`}
          </p>
          {proceso.detalleFinalizacion && <p className="mt-1">{proceso.detalleFinalizacion}</p>}
        </div>
      )}
    </>
  )
}

/** Reactivar no pide datos: una confirmación corta basta. */
function ModalReactivar({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const { enviando, error, enviar } = useEnvio(onConflicto)
  return (
    <ConfirmModal
      abierto
      titulo="Reactivar proceso"
      descripcion="El proceso vuelve a estar en trámite."
      confirmarLabel="Reactivar"
      cargando={enviando}
      error={error}
      onConfirmar={() =>
        void enviar(
          () => reactivarProceso(proceso.id, proceso.version),
          () => onHecho('Proceso reactivado'),
        )
      }
      onCancelar={onCerrar}
    />
  )
}

export default function DetalleProceso() {
  const { procesoId } = useParams<{ procesoId: string }>()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoJuridico()
  const cargar = useCallback(() => obtenerProceso(procesoId!), [procesoId])
  const { datos: proceso, error, recargar } = useRecurso(cargar)
  const [modal, setModal] = useState<ModalAbierto | null>(null)
  const [modalAudiencia, setModalAudiencia] = useState<ModalAudiencia | null>(null)
  const [versionAudiencias, setVersionAudiencias] = useState(0)

  useTituloPagina({
    titulo: proceso?.codigo ?? 'Proceso',
    migas: [
      { etiqueta: 'Procesos', ruta: RUTAS_JURIDICO.procesos() },
      ...(proceso
        ? [{ etiqueta: proceso.usuaria.nombreCompleto, ruta: RUTAS_JURIDICO.usuaria(proceso.usuaria.id) }]
        : []),
    ],
  })

  const refrescar = useCallback(() => {
    void recargar()
    recargarResumen()
  }, [recargar, recargarResumen])

  // Una audiencia cambia la próxima audiencia de la cabecera y, con un documento, sus carpetas.
  const cambiosAudiencia = useCallback(() => {
    setVersionAudiencias((version) => version + 1)
    refrescar()
  }, [refrescar])

  const abrirActuacion = useCallback(() => setModal('actuacion'), [])
  const abrirNumeroJudicial = useCallback(() => setModal('numeroJudicial'), [])
  const contexto = useMemo<ContextoDetalle | null>(
    () =>
      proceso
        ? { proceso, refrescar, abrirActuacion, abrirAudiencia: setModalAudiencia, versionAudiencias }
        : null,
    [proceso, refrescar, abrirActuacion, versionAudiencias],
  )

  if (error && !proceso) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="este proceso" onReintentar={() => void recargar()} />
  }
  if (!proceso || !contexto) return <Esqueleto />

  const acciones = proceso.accionesDisponibles
  const otros = proceso.otrosProcesosUsuaria
  const propsModal: PropsModalProceso = {
    proceso,
    onCerrar: () => setModal(null),
    onHecho: (mensaje) => {
      setModal(null)
      mostrar(mensaje)
      // Finalizar o abandonar cancela las audiencias programadas: la pestaña también se refresca.
      cambiosAudiencia()
    },
    onConflicto: refrescar,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <CabeceraProceso
        proceso={proceso}
        onAgendar={admiteAudiencias(proceso) ? () => setModalAudiencia({ tipo: 'AGENDAR', caso: casoDesdeProceso(proceso) }) : null}
        onActuacion={abrirActuacion}
        onReactivar={() => setModal('reactivar')}
        onNumeroJudicial={abrirNumeroJudicial}
      />

      <Banners proceso={proceso} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Outlet context={contexto} />
        </div>

        <aside className="space-y-4">
          <PanelDatos
            proceso={proceso}
            onNumeroJudicial={abrirNumeroJudicial}
            onGuardado={(mensaje) => {
              mostrar(mensaje)
              refrescar()
            }}
            onConflicto={refrescar}
          />
          <PanelCierre
            acciones={acciones}
            onFinalizar={() => setModal('finalizar')}
            onSuspender={() => setModal('suspender')}
            onAbandonar={() => setModal('abandono')}
          />
          {otros.length > 0 && (
            <section className={`${CLASE_TARJETA} p-4`}>
              <h3 className="mb-2.5 text-sm font-semibold text-gray-900">Otros procesos de la usuaria</h3>
              <ul>
                {otros.map((otro) => (
                  <li key={otro.id} className="py-1.5">
                    <Link to={RUTAS_JURIDICO.proceso(otro.id)} className="group block">
                      <span className="font-mono text-xs text-gray-500">{otro.codigo}</span>
                      <span className="block text-[13px] text-gray-900 group-hover:underline">
                        {ETIQUETAS_TIPO_PROCESO_JURIDICO[otro.tipo]}
                      </span>
                    </Link>
                    <div className="mt-1">
                      <EtiquetaEstado estado={otro.estadoVisible} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {modal === 'actuacion' && <ModalActuacion {...propsModal} />}
      {modal === 'finalizar' && <ModalFinalizar {...propsModal} />}
      {modal === 'suspender' && <ModalSuspender {...propsModal} />}
      {modal === 'abandono' && <ModalAbandono {...propsModal} />}
      {modal === 'reactivar' && <ModalReactivar {...propsModal} />}
      {modal === 'numeroJudicial' && (
        <ModalNumeroJudicial
          proceso={proceso}
          onCerrar={propsModal.onCerrar}
          onHecho={(mensaje) => {
            setModal(null)
            mostrar(mensaje)
            // La bitácora del proceso gana una entrada: se vuelve a pedir el detalle.
            refrescar()
          }}
          onConflicto={refrescar}
        />
      )}
      <ModalesAudiencia modal={modalAudiencia} onCambiar={setModalAudiencia} onCambios={cambiosAudiencia} />
    </div>
  )
}
