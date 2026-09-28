import { Link, useNavigate } from 'react-router-dom'
import { ETIQUETAS_ESTADO_TS, TONO_BADGE_ESTADO_TS, type FilaAtendidaReciente } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import { textoAreas } from '../usuarias/filaUsuaria'

/** "Atendidas recientemente": los últimos casos con movimiento, para retomarlos de un clic. */
export default function TablaRecientes({ filas }: { filas: FilaAtendidaReciente[] }) {
  const navigate = useNavigate()

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-gray-900">Atendidas recientemente</h2>
        <Link to="/trabajo-social/usuarias" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
          Ver todas las usuarias
        </Link>
      </div>
      {filas.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-500">Todavía no hay usuarias registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                {['Expediente', 'Usuaria', 'Áreas', 'Estado'].map((columna) => (
                  <th key={columna} scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-medium">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr
                  key={fila.expedienteId}
                  onClick={() => navigate(`/trabajo-social/usuarias/${fila.usuariaId}`)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums text-brand-700">
                    {fila.numeroExpediente}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{fila.nombreCompleto}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{textoAreas(fila.areas)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Badge tono={TONO_BADGE_ESTADO_TS[fila.estado]}>{ETIQUETAS_ESTADO_TS[fila.estado]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
