import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import {
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_MOTIVO_ABANDONO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoDetalle,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
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
import PanelDatos from './PanelDatos'
import { useEnvio } from './useEnvio'

type ModalAbierto = 'actuacion' | 'finalizar' | 'suspender' | 'abandono' | 'reactivar' | 'numeroJudicial'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

/** Colores del aviso de estado (los del mockup): gris en pausa, ámbar si se abandonó, verde al cerrar. */
const TONOS_AVISO = {
  suspendido: 'border-[#d9dce1] bg-[#f3f4f6] [--tono:#4a5360]',
  abandonado: 'border-[#ecd9b8] bg-[#fbf1de] [--tono:#8a5a14]',
  finalizado: 'border-[#c7e0cd] bg-[#e7f1ea] [--tono:#2f6b3f]',
}

function Aviso({
  tono,
  titulo,
  children,
  onReactivar,
}: {
  tono: keyof typeof TONOS_AVISO
  titulo: string
  children?: ReactNode
  onReactivar: (() => void) | null
}) {
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3.5 ${TONOS_AVISO[tono]}`}>
      <div className="min-w-0 flex-1 basis-[320px] space-y-0.5">
        <p className="text-[15px] font-semibold text-(--tono)">{titulo}</p>
        {children}
      </div>
      {onReactivar && (
        <Button variante="secondary" tamano="md" onClick={onReactivar}>
          Reactivar proceso
        </Button>
      )}
    </div>
  )
}

/** Por qué el proceso no está en trámite, y la salida para volver a abrirlo cuando se puede. */
function Banners({ proceso, onReactivar }: { proceso: ProcesoDetalle; onReactivar: () => void }) {
  const { abandonoVigente: abandono, suspensionVigente: suspension } = proceso
  const reactivar = proceso.accionesDisponibles.includes('REACTIVAR') ? onReactivar : null
  const CLASE_TEXTO = 'text-sm text-pretty text-gray-700'
  if (abandono) {
    return (
      <Aviso
        tono="abandonado"
        titulo={`Caso abandonado · ${formatFechaGT(abandono.fecha)} · ${ETIQUETAS_MOTIVO_ABANDONO[abandono.motivoCatalogo]}`}
        onReactivar={reactivar}
      >
        {abandono.observaciones && <p className={CLASE_TEXTO}>{abandono.observaciones}</p>}
        <p className="text-xs text-gray-600 tabular-nums">
          Último contacto: {abandono.ultimoContacto ? formatFechaGT(abandono.ultimoContacto) : 'no registrado'} ·{' '}
          {abandono.intentosContacto} {abandono.intentosContacto === 1 ? 'intento' : 'intentos'} de contacto ·{' '}
          {abandono.notificadoATs ? 'Notificado a Trabajo Social' : 'Sin notificar a Trabajo Social'}
        </p>
      </Aviso>
    )
  }
  if (suspension) {
    return (
      <Aviso tono="suspendido" titulo={`Proceso suspendido desde el ${fechaDeInstante(suspension.desde)}`} onReactivar={reactivar}>
        <p className={CLASE_TEXTO}>{suspension.motivo}</p>
      </Aviso>
    )
  }
  if (proceso.formaFinalizacion) {
    return (
      <Aviso
        tono="finalizado"
        titulo={`Finalizado por ${ETIQUETAS_FORMA_FINALIZACION[proceso.formaFinalizacion]}${
          proceso.fechaCierre ? ` · ${formatFechaGT(proceso.fechaCierre)}` : ''
        }`}
        onReactivar={reactivar}
      >
        {proceso.detalleFinalizacion && <p className={CLASE_TEXTO}>{proceso.detalleFinalizacion}</p>}
      </Aviso>
    )
  }
  return null
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
        onNumeroJudicial={abrirNumeroJudicial}
        onFinalizar={() => setModal('finalizar')}
        onSuspender={() => setModal('suspender')}
        onAbandonar={() => setModal('abandono')}
      />

      <Banners proceso={proceso} onReactivar={() => setModal('reactivar')} />

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
          {otros.length > 0 && (
            <section className={`${CLASE_TARJETA} px-[18px] py-4`}>
              <h3 className="mb-1.5 text-sm font-semibold text-gray-900">Otros procesos de la usuaria</h3>
              <ul className="-mx-2">
                {otros.map((otro) => (
                  <li key={otro.id}>
                    <Link
                      to={RUTAS_JURIDICO.proceso(otro.id)}
                      className="group flex flex-col items-start gap-1 rounded-lg px-2 py-2 hover:bg-gray-50"
                    >
                      <span className="font-mono text-xs text-gray-500">{otro.codigo}</span>
                      <span className="text-[13px] text-gray-900 group-hover:underline">
                        {ETIQUETAS_TIPO_PROCESO_JURIDICO[otro.tipo]}
                      </span>
                      <EtiquetaEstado estado={otro.estadoVisible} />
                    </Link>
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
