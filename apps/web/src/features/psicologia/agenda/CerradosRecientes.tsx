import { formatInstanteGT, type CasoCerradoResumen } from '@akyuam/shared'

/**
 * Bloque informativo y sin acción, por eso va colapsado y al final. Su destino definitivo es
 * Indicadores (§5.5 del plan), que todavía no expone el dato por rango; se conserva aquí para no
 * perder visibilidad mientras tanto.
 */
export default function CerradosRecientes({ cerrados }: { cerrados: CasoCerradoResumen[] }) {
  if (cerrados.length === 0) return null

  return (
    <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-800">
        Cerrados esta semana ({cerrados.length})
      </summary>
      <div className="divide-y divide-gray-100 border-t border-gray-100 px-4">
        {cerrados.map((cerrado) => (
          <div key={cerrado.expedienteId} className="py-2 text-sm">
            <p className="font-medium text-gray-800">{cerrado.usuariaNombreCompleto}</p>
            <p className="text-xs text-gray-500">{formatInstanteGT(cerrado.fechaCierre)}</p>
          </div>
        ))}
      </div>
    </details>
  )
}
