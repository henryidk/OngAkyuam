import { useCallback, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_MOTIVO_ABANDONO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoDetalle,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import Tabs from '../../../components/ui/Tabs'
import { useToast } from '../../../components/ui/Toast'
import { obtenerProceso, reactivarProceso } from '../api/juridico.api'
import BarraAvance from '../compartido/BarraAvance'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { fechaDeInstante } from '../compartido/formato'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import type { ContextoDetalle, PropsModalProceso } from './contextoDetalle'
import ModalAbandono from './ModalAbandono'
import ModalActuacion from './ModalActuacion'
import ModalEditarDatos from './ModalEditarDatos'
import ModalFinalizar from './ModalFinalizar'
import ModalSuspender from './ModalSuspender'
import PanelCierre from './PanelCierre'
import PanelDatos from './PanelDatos'
import { useEnvio } from './useEnvio'

type ModalAbierto = 'actuacion' | 'finalizar' | 'suspender' | 'abandono' | 'editar' | 'reactivar'

const CLASE_BANNER = 'rounded-xl border px-5 py-4 text-sm'

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

  const abrirActuacion = useCallback(() => setModal('actuacion'), [])
  const contexto = useMemo<ContextoDetalle | null>(
    () => (proceso ? { proceso, refrescar, abrirActuacion } : null),
    [proceso, refrescar, abrirActuacion],
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
      refrescar()
    },
    onConflicto: refrescar,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-700">{proceso.codigo}</span>
            <EtiquetaEstado estado={proceso.estadoVisible} />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</h2>
          <p className="text-sm text-gray-600">
            <Link to={RUTAS_JURIDICO.usuaria(proceso.usuaria.id)} className="font-medium text-brand-700 hover:underline">
              {proceso.usuaria.nombreCompleto}
            </Link>
            {proceso.contraparte && <> · contra {proceso.contraparte}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secondary" tamano="md" onClick={abrirActuacion}>
            Registrar actuación
          </Button>
          {acciones.includes('REACTIVAR') && (
            <Button tamano="md" onClick={() => setModal('reactivar')}>
              Reactivar proceso
            </Button>
          )}
        </div>
      </header>

      <Banners proceso={proceso} />
      <BarraAvance fase={proceso.fase} estado={proceso.estadoVisible} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Tabs
            className="border-b border-gray-200"
            items={[
              { to: RUTAS_JURIDICO.proceso(proceso.id), etiqueta: `Bitácora (${proceso.bitacora.length})`, fin: true },
              {
                to: RUTAS_JURIDICO.documentosProceso(proceso.id),
                etiqueta: `Documentos (${proceso.carpetas.reduce((total, carpeta) => total + carpeta.documentos.length, 0)})`,
              },
            ]}
          />
          <Outlet context={contexto} />
        </div>

        <aside className="space-y-4">
          <PanelDatos proceso={proceso} onEditar={() => setModal('editar')} />
          <PanelCierre
            acciones={acciones}
            onFinalizar={() => setModal('finalizar')}
            onSuspender={() => setModal('suspender')}
            onAbandonar={() => setModal('abandono')}
          />
          {otros.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Otros procesos de la usuaria</h3>
              <ul className="mt-3 space-y-2.5">
                {otros.map((otro) => (
                  <li key={otro.id}>
                    <Link to={RUTAS_JURIDICO.proceso(otro.id)} className="block hover:underline">
                      <span className="font-mono text-xs text-gray-600">{otro.codigo}</span>{' '}
                      <span className="text-sm text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[otro.tipo]}</span>
                    </Link>
                    <EtiquetaEstado estado={otro.estadoVisible} />
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
      {modal === 'editar' && <ModalEditarDatos {...propsModal} />}
      {modal === 'reactivar' && <ModalReactivar {...propsModal} />}
    </div>
  )
}
