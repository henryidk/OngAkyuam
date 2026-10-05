import { Link } from 'react-router-dom'
import { ETIQUETAS_FASE, ETIQUETAS_TIPO_PROCESO_JURIDICO, ETIQUETAS_TIPO_REGISTRO, type ProcesoResumen } from '@akyuam/shared'
import { BarraAvanceCompacta } from '../compartido/BarraAvance'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { fechaDeReferencia } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'
import { useContextoFicha } from './contextoFicha'
import { textoAgresor, textoHijas, textoTipologia } from './textoCaso'

function esActivo(proceso: ProcesoResumen) {
  return proceso.fase !== 'FINALIZADO' && proceso.situacion !== 'ABANDONADO'
}

function FilaProcesoActivo({ proceso }: { proceso: ProcesoResumen }) {
  return (
    <li>
      <Link
        to={RUTAS_JURIDICO.proceso(proceso.id)}
        className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-gray-700">{proceso.codigo}</span>
            <EtiquetaEstado estado={proceso.estadoVisible} />
          </div>
          <p className="text-sm font-semibold text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
          <p className="text-xs text-gray-500 tabular-nums">
            {proceso.abogada?.nombre ?? 'Sin abogada asignada'} · {fechaDeReferencia(proceso)}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-xs text-gray-500">{ETIQUETAS_FASE[proceso.fase]}</p>
          <BarraAvanceCompacta fase={proceso.fase} estado={proceso.estadoVisible} />
        </div>
      </Link>
    </li>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="py-1.5">
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className={`text-sm ${valor ? 'text-gray-800' : 'text-[#9ca3af]'}`}>{valor || '—'}</dd>
    </div>
  )
}

export default function PestanaResumen() {
  const { ficha, expedienteTs, errorExpedienteTs } = useContextoFicha()
  const activos = ficha.procesos.filter(esActivo)
  const pendiente = ficha.referencias.some((referencia) => referencia.estado === 'PENDIENTE')
  const datosCaso = expedienteTs?.datosCaso ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Procesos activos</h3>
          {ficha.procesos.length > 0 && (
            <Link to={RUTAS_JURIDICO.usuariaProcesos(ficha.usuaria.id)} className="text-xs font-medium text-brand-700 hover:underline">
              Ver historial completo
            </Link>
          )}
        </div>
        {activos.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {activos.map((proceso) => (
              <FilaProcesoActivo key={proceso.id} proceso={proceso} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-gray-500">
            {pendiente
              ? 'Aún no tiene procesos. Se abren al atender la referencia.'
              : 'No tiene procesos en curso. Usa “Abrir nuevo proceso” si regresa con una necesidad nueva.'}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Situación según Trabajo Social</h3>
          <Link to={RUTAS_JURIDICO.usuariaDatos(ficha.usuaria.id)} className="text-xs font-medium text-brand-700 hover:underline">
            Ver caso
          </Link>
        </div>
        <div className="px-5 py-3">
          {errorExpedienteTs ? (
            <p className="text-sm text-red-700">{errorExpedienteTs}</p>
          ) : !expedienteTs ? (
            <div className="h-24 animate-pulse rounded bg-gray-100" />
          ) : (
            <>
              <dl>
                <Dato etiqueta="Tipología" valor={datosCaso ? textoTipologia(datosCaso) : null} />
                <Dato etiqueta="Agresor" valor={datosCaso ? textoAgresor(datosCaso) : null} />
                <Dato etiqueta="Registro" valor={ETIQUETAS_TIPO_REGISTRO[expedienteTs.tipoRegistro]} />
                <Dato etiqueta="Hijas e hijos" valor={textoHijas(expedienteTs.ninos)} />
              </dl>
              {datosCaso?.observaciones && (
                <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {datosCaso.observaciones}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
