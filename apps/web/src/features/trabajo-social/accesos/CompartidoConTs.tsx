import { ETIQUETAS_AREA_ATENCION, type CompartidoArea } from '@akyuam/shared'
import type { useCompartido } from './useCompartido'

interface CompartidoConTsProps {
  compartido: ReturnType<typeof useCompartido>
}

function textoSinCompartir(area: CompartidoArea): string {
  return area.referida ? 'Todavía no ha compartido nada.' : 'El caso no está referido a esta área.'
}

function FilaArea({ area }: { area: CompartidoArea }) {
  const vacia = area.lineas.length === 0

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 ${
        vacia ? 'border-dashed border-gray-300' : 'border-gray-200'
      }`}
    >
      <span className="w-[72px] shrink-0 text-xs font-semibold text-brand-700">{ETIQUETAS_AREA_ATENCION[area.area]}</span>
      {vacia ? (
        <span className="text-[13px] text-gray-500">{textoSinCompartir(area)}</span>
      ) : (
        <ul className="space-y-1 text-[13px] text-gray-800">
          {area.lineas.map((linea) => (
            <li key={linea}>{linea}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

function EsqueletoCompartido() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((indice) => (
        <div key={indice} className="h-10 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  )
}

/** Segunda tarjeta de la pestaña Accesos: el sentido inverso de la matriz, de solo lectura. */
export default function CompartidoConTs({ compartido }: CompartidoConTsProps) {
  const { areas, error, recargar } = compartido

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-4">
        <h2 className="text-[15px] font-semibold text-gray-900">Compartido con Trabajo Social por otras áreas</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Solo lectura. Cada área decide qué publica; Psicología solo comparte la fecha de la próxima cita.
        </p>
      </div>

      <div className="px-5 pb-5">
        {error && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => void recargar()} className="mt-1 font-medium underline">
              Reintentar
            </button>
          </div>
        )}
        {!error && !areas && <EsqueletoCompartido />}
        {!error && areas && (
          <ul className="space-y-2">
            {areas.map((area) => (
              <FilaArea key={area.area} area={area} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
