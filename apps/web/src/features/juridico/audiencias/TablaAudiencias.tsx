import { Fragment } from 'react'
import { hoyGT, type AccionAudiencia, type AudienciaFilaDto, type VistaAudiencias } from '@akyuam/shared'
import FilaAudiencia from './FilaAudiencia'
import { agruparPorDia } from './formato'

const COLUMNAS = ['Usuaria', 'No. interno', 'No. judicial', 'Fecha', 'Hora', 'Responsable', 'Estado']

interface TablaAudienciasProps {
  items: AudienciaFilaDto[] | null
  vista: VistaAudiencias
  /** Recargando con datos a la vista: se atenúan en vez de desaparecer. */
  atenuada: boolean
  onAccion: (accion: AccionAudiencia, audiencia: AudienciaFilaDto) => void
}

function FilasEsqueleto() {
  return (
    <>
      {Array.from({ length: 5 }, (_, indice) => (
        <tr key={indice} className="border-t border-gray-100">
          {[...COLUMNAS, 'acciones'].map((columna) => (
            <td key={columna} className="px-3 py-3">
              <div className="h-4 animate-pulse rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Próximas se agrupa por día con "Hoy" resaltado; las otras pestañas son una lista corrida. */
export default function TablaAudiencias({ items, vista, atenuada, onAccion }: TablaAudienciasProps) {
  const fila = (audiencia: AudienciaFilaDto) => (
    <FilaAudiencia key={audiencia.id} audiencia={audiencia} vista={vista} onAccion={onAccion} />
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
          <tr>
            {COLUMNAS.map((columna) => (
              <th key={columna} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium">
                {columna}
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className={atenuada ? 'opacity-60' : undefined}>
          {!items && <FilasEsqueleto />}
          {items && vista !== 'proximas' && items.map(fila)}
          {items &&
            vista === 'proximas' &&
            agruparPorDia(items, hoyGT()).map((grupo) => (
              <Fragment key={grupo.fecha}>
                <tr className={`border-t border-gray-200 ${grupo.esHoy ? 'bg-[#f7f3fc]' : 'bg-[#fcfcfd]'}`}>
                  <th
                    scope="colgroup"
                    colSpan={COLUMNAS.length + 1}
                    className={`px-4 py-2 text-[13px] font-semibold ${grupo.esHoy ? 'text-[#5b3985]' : 'text-gray-700'}`}
                  >
                    {grupo.etiqueta}
                    <span className="ml-2 font-normal text-gray-500">
                      · {grupo.items.length} {grupo.items.length === 1 ? 'audiencia' : 'audiencias'}
                    </span>
                  </th>
                </tr>
                {grupo.items.map(fila)}
              </Fragment>
            ))}
        </tbody>
      </table>
    </div>
  )
}
