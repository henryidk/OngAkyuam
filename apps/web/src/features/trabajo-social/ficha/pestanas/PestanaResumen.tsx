import {
  AREAS_ATENCION,
  diasDesdeFechaGT,
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_ESTADO_AREA,
  ETIQUETAS_TIPO_DOCUMENTO,
  formatFechaGT,
  formatInstanteGT,
  TONO_BADGE_ESTADO_AREA,
  type AreaAtencion,
  type EstadoAreaCaso,
  type ExpedienteDetalleCaso,
  type ExpedienteResumenCaso,
} from '@akyuam/shared'
import Badge from '../../../../components/ui/Badge'
import Button from '../../../../components/ui/Button'
import { ABREVIATURA_AREA } from '../../abreviaturaArea'
import { useDocumentosCaso } from '../../documentos/useDocumentosCaso'
import { useContextoFicha } from '../contextoFicha'
import { textoAgresor, textoNino, textoTipologia } from '../textoCaso'
import { useDetalleCaso } from '../useDetalleCaso'
import Tarjeta, { Dato } from './Tarjeta'

/** Pestaña índice de la ficha (plan §12.5): cómo va la atención del caso actual, de un vistazo. */
export default function PestanaResumen() {
  const { usuaria, abrirReferir, version } = useContextoFicha()
  const casoActual = usuaria.casos[0] ?? null
  const { detalle, error } = useDetalleCaso(casoActual?.id ?? null, version)

  if (!casoActual || !usuaria.casoActivo) {
    return <p className="text-sm text-gray-500">Esta usuaria todavía no tiene ningún caso registrado.</p>
  }

  const areas = usuaria.casoActivo.areas

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Tarjeta titulo="Áreas que la atienden" enlace={{ to: 'accesos', texto: 'Gestionar accesos' }}>
          <ul className="divide-y divide-gray-100">
            {AREAS_ATENCION.map((area) => {
              const estado = areas.find((a) => a.area === area)
              return (
                <li key={area} className="py-3 first:pt-0 last:pb-0">
                  {estado ? (
                    <FilaAreaReferida estado={estado} />
                  ) : (
                    <FilaAreaNoReferida area={area} onReferir={() => abrirReferir(area)} />
                  )}
                </li>
              )
            })}
          </ul>
        </Tarjeta>

        <Tarjeta
          titulo={
            <>
              Caso actual · <span className="tabular-nums">{casoActual.numero}</span> ·{' '}
              <span className="tabular-nums">{formatFechaGT(casoActual.fecha)}</span>
            </>
          }
          enlace={{ to: 'casos', texto: 'Ver casos' }}
        >
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!error && !detalle && <div className="h-16 animate-pulse rounded bg-gray-100" />}
          {detalle && (
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
              <Dato etiqueta="Tipología 22-2008">{textoTipologia(detalle)}</Dato>
              <Dato etiqueta="Agresor">{textoAgresor(detalle)}</Dato>
              <Dato etiqueta="Observaciones">
                <span className="whitespace-pre-line">{detalle.observaciones || '—'}</span>
              </Dato>
            </dl>
          )}
        </Tarjeta>
      </div>

      <div className="space-y-4">
        {detalle && <TarjetaAlbergue caso={casoActual} detalle={detalle} />}
        <TarjetaPendientes caso={casoActual} sinReferir={areas.length === 0} />
        <Tarjeta titulo="Contacto" enlace={{ to: 'datos', texto: 'Ver datos' }}>
          <dl className="grid grid-cols-[90px_1fr] gap-x-4 gap-y-2 text-sm">
            <Dato etiqueta="Teléfono">
              <span className="tabular-nums">{usuaria.telefono || '—'}</span>
            </Dato>
            <Dato etiqueta="Dirección">{usuaria.direccion || '—'}</Dato>
          </dl>
        </Tarjeta>
      </div>
    </div>
  )
}

function FilaAreaReferida({ estado }: { estado: EstadoAreaCaso }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
        {ABREVIATURA_AREA[estado.area]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{ETIQUETAS_AREA_ATENCION[estado.area]}</p>
          <Badge tono={TONO_BADGE_ESTADO_AREA[estado.estado]}>{ETIQUETAS_ESTADO_AREA[estado.estado]}</Badge>
          {estado.prioridad === 'URGENTE' && <Badge tono="danger">Urgente</Badge>}
        </div>
        <p className="mt-0.5 text-[13px] text-gray-600">
          {estado.detalle}
          {estado.profesional && ` · ${estado.profesional}`}
        </p>
        <p className="text-xs tabular-nums text-gray-500">Referida el {formatInstanteGT(estado.referidoEn)}</p>
      </div>
    </div>
  )
}

function FilaAreaNoReferida({ area, onReferir }: { area: AreaAtencion; onReferir: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-400">
        {ABREVIATURA_AREA[area]}
      </span>
      <p className="flex-1 text-sm text-gray-500">{ETIQUETAS_AREA_ATENCION[area]} · no referida</p>
      <Button variante="acento" onClick={onReferir}>
        Referir
      </Button>
    </div>
  )
}

function TarjetaAlbergue({ caso, detalle }: { caso: ExpedienteResumenCaso; detalle: ExpedienteDetalleCaso }) {
  if (!caso.enAlbergue || !detalle.fechaIngresoAlbergue) return null
  const dias = diasDesdeFechaGT(detalle.fechaIngresoAlbergue)

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <h2 className="text-[15px] font-semibold text-brand-800">En albergue</h2>
      <p className="mt-1 text-sm tabular-nums text-brand-800">
        Ingresó el {formatFechaGT(detalle.fechaIngresoAlbergue)} ·{' '}
        <span className="font-semibold">
          {dias} {dias === 1 ? 'día' : 'días'}
        </span>
      </p>
      {detalle.ninos.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[13px] text-brand-700">
          {detalle.ninos.map((nino, indice) => (
            <li key={indice}>{textoNino(nino)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-brand-700">Ingresó sin hijas ni hijos.</p>
      )}
    </section>
  )
}

function TarjetaPendientes({ caso, sinReferir }: { caso: ExpedienteResumenCaso; sinReferir: boolean }) {
  const { documentos, error } = useDocumentosCaso(caso.id)
  const faltantes = documentos?.filas.filter((fila) => fila.requerido && fila.estado === 'FALTANTE') ?? []

  const pendientes = [
    ...(sinReferir ? [{ clave: 'referir', texto: 'Referirla a un área de atención' }] : []),
    ...faltantes.map((fila) => ({ clave: fila.tipo, texto: `Subir ${ETIQUETAS_TIPO_DOCUMENTO[fila.tipo]}` })),
  ]

  return (
    <Tarjeta titulo="Pendientes" enlace={faltantes.length > 0 ? { to: 'documentos', texto: 'Ir a documentos' } : undefined}>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && !documentos && <div className="h-10 animate-pulse rounded bg-gray-100" />}
      {documentos &&
        (pendientes.length === 0 ? (
          <p className="text-sm text-gray-500">Nada pendiente en este caso.</p>
        ) : (
          <ul className="space-y-1.5">
            {pendientes.map((pendiente) => (
              <li key={pendiente.clave} className="flex items-start gap-2 text-sm text-gray-700">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                {pendiente.texto}
              </li>
            ))}
          </ul>
        ))}
    </Tarjeta>
  )
}
