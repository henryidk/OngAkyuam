import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ETIQUETAS_ESTADO_TS,
  ETIQUETAS_TIPO_REGISTRO,
  formatFechaGT,
  TONO_BADGE_ESTADO_TS,
  type ExpedienteResumenCaso,
} from '@akyuam/shared'
import Badge from '../../../../components/ui/Badge'
import Button from '../../../../components/ui/Button'
import { textoAreas } from '../../usuarias/filaUsuaria'
import { useContextoFicha } from '../contextoFicha'
import { textoAgresor, textoTipologia } from '../textoCaso'
import { useDetalleCaso } from '../useDetalleCaso'
import { Dato } from './Tarjeta'

/** Casos (plan §12.5): un bloque por expediente, el más reciente primero. */
export default function PestanaCasos() {
  const { usuaria, version } = useContextoFicha()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-gray-500">
          Cada vez que vuelve a buscar ayuda se registra un caso nuevo con su propio número de expediente. Sus datos
          personales se comparten; la tipología, el agresor, los documentos y los accesos son de cada caso.
        </p>
        <Button
          variante="secondary"
          tamano="md"
          onClick={() => navigate('/trabajo-social/registrar', { state: { usuariaId: usuaria.id } })}
        >
          <Plus className="h-4 w-4" />
          Registrar nuevo caso
        </Button>
      </div>

      {usuaria.casos.map((caso, indice) => (
        <TarjetaCaso key={caso.id} caso={caso} actual={indice === 0} version={version} />
      ))}
    </div>
  )
}

function TarjetaCaso({ caso, actual, version }: { caso: ExpedienteResumenCaso; actual: boolean; version: number }) {
  const { detalle, error } = useDetalleCaso(caso.id, version)
  // El caso activo es el que abre la ficha por defecto: sus enlaces no llevan `?caso=`.
  const sufijo = actual ? '' : `?caso=${caso.id}`

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold tabular-nums text-gray-900">
            Expediente {caso.numero} · {formatFechaGT(caso.fecha)}
          </h2>
          <Badge tono={actual ? 'brand' : 'neutral'}>{actual ? 'Actual' : 'Anterior'}</Badge>
          <Badge tono={TONO_BADGE_ESTADO_TS[caso.estado]}>{ETIQUETAS_ESTADO_TS[caso.estado]}</Badge>
        </div>
        <div className="flex gap-3 text-[13px] font-medium">
          <Link to={`../documentos${sufijo}`} relative="path" className="text-brand-600 hover:underline">
            Documentos
          </Link>
          <Link to={`../accesos${sufijo}`} relative="path" className="text-brand-600 hover:underline">
            Accesos
          </Link>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">
        {ETIQUETAS_TIPO_REGISTRO[caso.tipoRegistro]}
        {caso.enAlbergue && ' · en albergue'}
      </p>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {!error && !detalle && <div className="mt-3 h-16 animate-pulse rounded bg-gray-100" />}
      {detalle && (
        <dl className="mt-3 grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 text-sm">
          <Dato etiqueta="Tipología 22-2008">{textoTipologia(detalle)}</Dato>
          <Dato etiqueta="Agresor">{textoAgresor(detalle)}</Dato>
          <Dato etiqueta="Referida a">{textoAreas(caso.areasReferidas)}</Dato>
          <Dato etiqueta="Observaciones">
            <span className="whitespace-pre-line">{detalle.observaciones || '—'}</span>
          </Dato>
        </dl>
      )}
    </section>
  )
}
