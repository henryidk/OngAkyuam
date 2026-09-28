import MatrizAccesos from '../../accesos/MatrizAccesos'
import type { useMatrizAccesos } from '../../accesos/useMatrizAccesos'

interface PestanaAccesosProps {
  /** El estado vive en el padre para que "Referir" pueda recargar la matriz al terminar. */
  accesos: ReturnType<typeof useMatrizAccesos>
}

function EsqueletoMatriz() {
  return (
    <div className="space-y-2 px-5 pb-5">
      {[0, 1, 2, 3].map((indice) => (
        <div key={indice} className="h-10 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  )
}

export default function PestanaAccesos({ accesos }: PestanaAccesosProps) {
  const { matriz, error, errorCambio, cambiar } = accesos

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-4">
        <h2 className="text-[15px] font-semibold text-gray-900">Qué puede ver cada área</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Privado por defecto. Jurídico tiene acceso completo y no se puede restringir. Un área no referida no ve nada.
        </p>
      </div>

      {error && (
        <p className="mx-5 mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {errorCambio && (
        <p role="alert" className="mx-5 mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se guardó el cambio: {errorCambio}
        </p>
      )}

      {!error && !matriz && <EsqueletoMatriz />}
      {matriz && <MatrizAccesos matriz={matriz} onCambiar={(clave, area, visible) => void cambiar(clave, area, visible)} />}
    </section>
  )
}
