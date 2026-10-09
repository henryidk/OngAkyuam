import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_REGISTRO, type ProcesoPsicologiaResumen } from '@akyuam/shared'
import { textoAgresor, textoHijas, textoTipologia } from '../../juridico/usuarias/textoCaso'
import EtiquetaEtapa from '../compartido/EtiquetaEtapa'
import { RUTAS_PSICOLOGIA } from '../rutas'
import { useContextoFicha } from './contextoFicha'
import { textoSesiones, textoSiguiente } from './textoProceso'
import CodigoProceso from '../compartido/CodigoProceso'

function FilaProcesoActivo({ proceso }: { proceso: ProcesoPsicologiaResumen }) {
  return (
    <li>
      <Link to={RUTAS_PSICOLOGIA.proceso(proceso.id)} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <CodigoProceso codigo={proceso.codigo} className="text-gray-700" />
            <EtiquetaEtapa etapa={proceso.etapa} />
          </div>
          <p className="text-xs text-gray-500 tabular-nums">{textoSesiones(proceso)}</p>
        </div>
        <p className={`text-xs tabular-nums ${proceso.proximaCita ? 'text-gray-600' : 'font-medium text-amber-800'}`}>
          {textoSiguiente(proceso)}
        </p>
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
  const activos = ficha.procesos.filter((proceso) => proceso.etapa !== 'CIERRE')
  const pendiente = ficha.referencias.some((referencia) => referencia.estado !== 'ATENDIDA')
  const datosCaso = expedienteTs?.datosCaso ?? null

  let sinActivos = 'No tienes procesos en curso con esta usuaria.'
  if (pendiente) sinActivos = 'Aún no tiene proceso. Se abre al agendar la primera cita de la referencia.'
  else if (ficha.puedeAbrirProceso) sinActivos = 'No tiene procesos en curso. Usa “Abrir nuevo proceso” si regresa.'

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Procesos activos</h3>
          {ficha.procesos.length + ficha.procesosDeColegas.length > 0 && (
            <Link to={RUTAS_PSICOLOGIA.usuariaProcesos(ficha.usuaria.id)} className="text-xs font-medium text-brand-700 hover:underline">
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
          <p className="px-5 py-6 text-sm text-gray-500">{sinActivos}</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Situación según Trabajo Social</h3>
          <Link to={RUTAS_PSICOLOGIA.usuariaDatos(ficha.usuaria.id)} className="text-xs font-medium text-brand-700 hover:underline">
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
                {datosCaso && (
                  <>
                    <Dato etiqueta="Tipología" valor={textoTipologia(datosCaso)} />
                    <Dato etiqueta="Agresor" valor={textoAgresor(datosCaso)} />
                  </>
                )}
                <Dato etiqueta="Registro" valor={ETIQUETAS_TIPO_REGISTRO[expedienteTs.tipoRegistro]} />
                <Dato etiqueta="Hijas e hijos" valor={textoHijas(expedienteTs.ninos)} />
              </dl>
              {datosCaso?.observaciones && (
                <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {datosCaso.observaciones}
                </p>
              )}
              {!datosCaso && (
                <p className="mt-2 text-xs text-gray-500">
                  Trabajo Social no compartió con Psicología la tipología, el agresor ni las observaciones.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
