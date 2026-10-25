import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_TIPO_REGISTRO,
  formatFechaLargaGT,
  hoyGT,
  type BandejaTs,
  type FilaColaReferir,
  type FiltroListaUsuarias,
} from '@akyuam/shared'
import { useContextoTrabajoSocial } from '../../../pages/trabajo-social/TrabajoSocialLayout'
import { useAuthStore } from '../../../store/auth.store'
import ModalReferir from '../referir/ModalReferir'
import { cuandoTexto, saludoSegunHora, textoDias } from './textoBandeja'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'
const CLASE_ENLACE = 'text-[13px] font-medium text-brand-700 hover:underline'
const CLASE_FILA = 'flex items-center gap-3 border-t border-gray-100 px-4 py-3'
const CLASE_ACCION =
  'whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50'
const CLASE_AMBAR = 'text-[#8a5a14]'

function rutaLista(filtro: FiltroListaUsuarias): string {
  return `/trabajo-social/usuarias?estado=${filtro}`
}

function plural(total: number, singular: string, varios: string): string {
  return `${total} ${total === 1 ? singular : varios}`
}

interface IndicadorProps {
  etiqueta: string
  valor: number
  detalle: string
  destino: string
  /** Hay algo pendiente detrás del número: se pinta en ámbar. */
  alerta?: boolean
}

function Indicador({ etiqueta, valor, detalle, destino, alerta = false }: IndicadorProps) {
  return (
    <Link to={destino} className="group bg-white px-5 py-4 hover:bg-gray-50">
      <p className="text-[13px] text-gray-600">{etiqueta}</p>
      <p className={`mt-1 text-[30px] font-semibold leading-none tabular-nums ${alerta ? CLASE_AMBAR : 'text-gray-900'}`}>
        {valor}
      </p>
      <p className="mt-2 text-[12.5px] text-gray-500 group-hover:text-gray-700">{detalle}</p>
    </Link>
  )
}

function Indicadores({ bandeja }: { bandeja: BandejaTs }) {
  const { indicadores, pendientesReferir, enAlbergue } = bandeja
  const sinReferir = pendientesReferir.total

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 lg:grid-cols-4">
      <Indicador
        etiqueta="Sin referir"
        valor={sinReferir}
        detalle={sinReferir === 0 ? 'Todas tienen un área asignada' : 'Registradas sin ningún área'}
        destino={rutaLista('SIN_REFERIR')}
        alerta={sinReferir > 0}
      />
      <Indicador
        etiqueta="En atención"
        valor={indicadores.enAtencion}
        detalle="Con al menos un área atendiéndolas"
        destino={rutaLista('EN_ATENCION')}
      />
      <Indicador
        etiqueta="Sin atención activa"
        valor={indicadores.sinAtencionActiva}
        detalle="Referidas; ningún área las atiende ahora"
        destino={rutaLista('SIN_ATENCION_ACTIVA')}
      />
      <Indicador
        etiqueta="En albergue"
        valor={enAlbergue.total}
        detalle={
          indicadores.ninosEnAlbergue === 0
            ? 'Sin hijas/hijos ingresados'
            : `Con ${plural(indicadores.ninosEnAlbergue, 'hija/hijo', 'hijas/hijos')}`
        }
        destino={rutaLista('EN_ALBERGUE')}
      />
    </div>
  )
}

interface SeccionProps {
  titulo: string
  ayuda?: string
  enlace?: { texto: string; destino: string }
  children: ReactNode
}

function Seccion({ titulo, ayuda, enlace, children }: SeccionProps) {
  return (
    <section className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
          {ayuda && <p className="mt-0.5 text-xs text-gray-500">{ayuda}</p>}
        </div>
        {enlace && (
          <Link to={enlace.destino} className={CLASE_ENLACE}>
            {enlace.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="border-t border-gray-100 px-4 py-3.5 text-[13px] text-gray-500">{children}</p>
}

function NombreUsuaria({ usuariaId, nombre, detalle }: { usuariaId: string; nombre: string; detalle: string }) {
  return (
    <div className="min-w-0 flex-1">
      <Link
        to={`/trabajo-social/usuarias/${usuariaId}`}
        className="block truncate text-sm font-medium text-gray-900 hover:underline"
      >
        {nombre}
      </Link>
      <p className="mt-0.5 truncate text-xs tabular-nums text-gray-500">{detalle}</p>
    </div>
  )
}

/** Lo que espera a Trabajo Social: referir a quien todavía no tiene ningún área. */
function PorReferir({ cola, onReferir }: { cola: BandejaTs['pendientesReferir']; onReferir: (fila: FilaColaReferir) => void }) {
  return (
    <Seccion
      titulo="Por referir a un área"
      ayuda="Registradas sin ningún área todavía. La más reciente va primero."
      enlace={cola.total > cola.filas.length ? { texto: `Ver las ${cola.total}`, destino: rutaLista('SIN_REFERIR') } : undefined}
    >
      {cola.total === 0 && <Vacio>Todas las usuarias tienen un área asignada.</Vacio>}
      {cola.filas.map((fila) => (
        <div key={fila.expedienteId} className={CLASE_FILA}>
          <NombreUsuaria
            usuariaId={fila.usuariaId}
            nombre={fila.nombreCompleto}
            detalle={`Exp. ${fila.numeroExpediente} · ${ETIQUETAS_TIPO_REGISTRO[fila.tipoRegistro]} · registrada ${cuandoTexto(fila.createdAt).toLowerCase()}`}
          />
          <button type="button" onClick={() => onReferir(fila)} className={CLASE_ACCION}>
            Referir
          </button>
        </div>
      ))}
    </Seccion>
  )
}

function EnAlbergue({ cola }: { cola: BandejaTs['enAlbergue'] }) {
  return (
    <Seccion
      titulo="En albergue"
      ayuda="Usuarias internas sin egreso. La que más tiempo lleva va primero."
      enlace={cola.total > cola.filas.length ? { texto: `Ver las ${cola.total}`, destino: rutaLista('EN_ALBERGUE') } : undefined}
    >
      {cola.total === 0 && <Vacio>No hay usuarias en el albergue.</Vacio>}
      {cola.filas.map((fila) => (
        <div key={fila.expedienteId} className={CLASE_FILA}>
          <NombreUsuaria
            usuariaId={fila.usuariaId}
            nombre={fila.nombreCompleto}
            detalle={`Exp. ${fila.numeroExpediente}${
              fila.cantidadNinos > 0 ? ` · con ${plural(fila.cantidadNinos, 'hija/hijo', 'hijas/hijos')}` : ''
            }`}
          />
          <span className="whitespace-nowrap text-xs tabular-nums text-gray-500">
            {fila.diasEnAlbergue === null ? 'Sin fecha de ingreso' : textoDias(fila.diasEnAlbergue)}
          </span>
        </div>
      ))}
    </Seccion>
  )
}

function PorArea({ activos }: { activos: BandejaTs['indicadores']['activosPorArea'] }) {
  const maximo = Math.max(0, ...activos.map((fila) => fila.total))
  return (
    <Seccion titulo="Casos en atención por área" ayuda="Una usuaria cuenta en cada área que la atiende ahora.">
      {maximo === 0 ? (
        <Vacio>Ningún área tiene casos activos.</Vacio>
      ) : (
        <ul className="space-y-3 border-t border-gray-100 px-4 py-4">
          {activos.map((fila) => (
            <li key={fila.area}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-gray-700">{ETIQUETAS_AREA_ATENCION[fila.area]}</span>
                <span className="font-medium tabular-nums text-gray-900">{fila.total}</span>
              </div>
              <span className="mt-1.5 block h-1.5 rounded-full bg-gray-100" aria-hidden="true">
                <span
                  className="block h-1.5 rounded-full bg-brand-500"
                  style={{ width: `${(fila.total / maximo) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  )
}

function EsqueletoInicio() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="h-[104px] animate-pulse rounded-xl bg-gray-100" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
      </div>
    </div>
  )
}

/**
 * Inicio de Trabajo Social: cómo están las usuarias y qué espera de Trabajo Social, en vivo por
 * socket. Es el mismo para todo el personal del área.
 */
export default function Bandeja() {
  const nombre = useAuthStore((estado) => estado.usuario?.nombreCompleto.split(/\s+/)[0] ?? '')
  const { bandeja, error, recargar } = useContextoTrabajoSocial()
  const [referir, setReferir] = useState<FilaColaReferir | null>(null)

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <div>
        <p className="text-[22px] font-semibold tracking-tight text-gray-900">
          {saludoSegunHora()}
          {nombre && `, ${nombre}`}
        </p>
        <p className="mt-1 text-sm text-gray-500">{formatFechaLargaGT(hoyGT())}</p>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!bandeja ? (
        !error && <EsqueletoInicio />
      ) : (
        <>
          <Indicadores bandeja={bandeja} />
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <PorReferir cola={bandeja.pendientesReferir} onReferir={setReferir} />
            <div className="space-y-5">
              <EnAlbergue cola={bandeja.enAlbergue} />
              <PorArea activos={bandeja.indicadores.activosPorArea} />
            </div>
          </div>
        </>
      )}

      {referir && (
        <ModalReferir
          expedienteId={referir.expedienteId}
          numeroExpediente={referir.numeroExpediente}
          nombreUsuaria={referir.nombreCompleto}
          areasReferidas={[]}
          onCerrar={() => setReferir(null)}
          onReferido={() => {
            setReferir(null)
            void recargar()
          }}
        />
      )}
    </div>
  )
}
