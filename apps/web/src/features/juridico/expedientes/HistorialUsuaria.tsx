import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Scale } from 'lucide-react'
import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type EstadoReferenciaJuridico,
  type HistorialUsuariaDto,
  type ProcesoResumen,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Badge, { type BadgeTono } from '../../../components/ui/Badge'
import EmptyState from '../../../components/ui/EmptyState'
import { obtenerHistorialUsuaria } from '../api/juridico.api'
import { BarraAvanceCompacta } from '../compartido/BarraAvance'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import EtiquetaForma from '../compartido/EtiquetaForma'
import { fechaDeInstante, fechaDeReferencia, iniciales, textoAlerta } from '../compartido/formato'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'

const REFERENCIA: Record<EstadoReferenciaJuridico, { etiqueta: string; tono: BadgeTono }> = {
  PENDIENTE: { etiqueta: 'Pendiente', tono: 'warning' },
  ATENDIDA: { etiqueta: 'Atendida', tono: 'success' },
  DEVUELTA: { etiqueta: 'Devuelta', tono: 'neutral' },
}

const CLASE_BOTON_PRIMARIO =
  'inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700'

/**
 * Expediente sobre el que se registra un proceso nuevo: el de la referencia pendiente si la hay;
 * si no, el más reciente que Jurídico ya conoce de esta usuaria.
 */
function expedienteParaRegistrar(historial: HistorialUsuariaDto) {
  const pendiente = historial.referencias.find((referencia) => referencia.estado === 'PENDIENTE')
  if (pendiente) return { expedienteId: pendiente.expedienteId, referidoId: pendiente.referidoId }
  const expedienteId = historial.referencias[0]?.expedienteId ?? historial.procesos[0]?.expedienteId
  return expedienteId ? { expedienteId } : null
}

function TarjetaProceso({ proceso }: { proceso: ProcesoResumen }) {
  const alerta = textoAlerta(proceso)
  return (
    <Link
      to={RUTAS_JURIDICO.proceso(proceso.id)}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-600"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13px] font-medium text-gray-700">{proceso.codigo}</span>
          <EtiquetaEstado estado={proceso.estadoVisible} />
          {proceso.formaFinalizacion && <EtiquetaForma forma={proceso.formaFinalizacion} />}
        </div>
        <p className="text-sm font-semibold text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
        <p className="text-xs text-gray-500 tabular-nums">
          Iniciado {formatFechaGT(proceso.fechaInicio)} · {fechaDeReferencia(proceso)} ·{' '}
          {proceso.abogada?.nombre ?? 'Sin abogada asignada'}
        </p>
      </div>
      <div className="space-y-1">
        <BarraAvanceCompacta fase={proceso.fase} estado={proceso.estadoVisible} />
        {alerta && <p className="text-xs font-medium text-[#8a5a14]">● {alerta}</p>}
      </div>
      <span className="text-sm font-medium text-brand-700">Abrir →</span>
    </Link>
  )
}

export default function HistorialUsuaria() {
  const { usuariaId } = useParams<{ usuariaId: string }>()
  const cargar = useCallback(() => obtenerHistorialUsuaria(usuariaId!), [usuariaId])
  const { datos: historial, error, recargar } = useRecurso(cargar)

  useTituloPagina({
    titulo: historial?.usuaria.nombreCompleto ?? 'Expediente',
    migas: [{ etiqueta: 'Expedientes', ruta: RUTAS_JURIDICO.expedientes() }],
  })

  if (error) {
    return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="este expediente" onReintentar={() => void recargar()} />
  }
  if (!historial) return <Esqueleto />

  const { usuaria, contadores, procesos, referencias } = historial
  const destino = expedienteParaRegistrar(historial)
  const pendiente = referencias.find((referencia) => referencia.estado === 'PENDIENTE')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700"
        >
          {iniciales(usuaria.nombreCompleto)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{usuaria.nombreCompleto}</h2>
          <p className="flex flex-wrap gap-x-4 text-xs text-gray-500 tabular-nums">
            <span>{usuaria.dpi ? `DPI ${usuaria.dpi}` : 'Sin DPI registrado'}</span>
            {usuaria.telefono && <span>Tel. {usuaria.telefono}</span>}
          </p>
        </div>
        <dl className="flex gap-5 text-center">
          {(
            [
              ['Iniciados', contadores.activos],
              ['Finalizados', contadores.finalizados],
              ['Abandonados', contadores.abandonados],
            ] as const
          ).map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <dd className="text-xl font-semibold tabular-nums text-gray-900">{valor}</dd>
              <dt className="text-[11px] text-gray-500">{etiqueta}</dt>
            </div>
          ))}
        </dl>
        {destino && (
          <Link to={RUTAS_JURIDICO.registrar(destino)} className={CLASE_BOTON_PRIMARIO}>
            + Registrar procesos
          </Link>
        )}
      </header>

      {pendiente && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Referencia pendiente · {fechaDeInstante(pendiente.referidoEn)}
            </p>
            <p className="text-sm text-gray-700">{pendiente.motivo || 'Sin motivo registrado.'}</p>
          </div>
          <Link
            to={RUTAS_JURIDICO.registrar({ expedienteId: pendiente.expedienteId, referidoId: pendiente.referidoId })}
            className={CLASE_BOTON_PRIMARIO}
          >
            Registrar procesos desde referencia
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Historial de procesos</h3>
        {procesos.length === 0 ? (
          <EmptyState
            Icono={Scale}
            titulo="Esta usuaria aún no tiene procesos jurídicos"
            descripcion="Use «Registrar procesos» para abrir el primero."
          />
        ) : (
          procesos.map((proceso) => <TarjetaProceso key={proceso.id} proceso={proceso} />)
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Referencias recibidas de Trabajo Social</h3>
        {referencias.length === 0 ? (
          <p className="text-sm text-gray-500">No hay referencias registradas.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {referencias.map((referencia) => (
              <li key={referencia.referidoId} className="flex flex-wrap items-start gap-4 px-5 py-3">
                <span className="w-24 shrink-0 text-xs text-gray-500 tabular-nums">
                  {fechaDeInstante(referencia.referidoEn)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">{referencia.motivo || 'Sin motivo registrado.'}</p>
                  <p className="text-xs text-gray-500">
                    Expediente {referencia.expedienteNumero}
                    {referencia.procesosSugeridos.length > 0 &&
                      ` · Sugerido: ${referencia.procesosSugeridos
                        .map((tipo) => ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo])
                        .join(', ')}`}
                  </p>
                </div>
                <Badge tono={REFERENCIA[referencia.estado].tono}>{REFERENCIA[referencia.estado].etiqueta}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
