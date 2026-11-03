import { Fragment } from 'react'
import { hoyGT, type AccionAudiencia, type AudienciaFilaDto, type VistaAudiencias } from '@akyuam/shared'
import FilaAudiencia from './FilaAudiencia'
import { agruparPorDia } from './formato'

/**
 * Cada pestaña muestra solo lo que ayuda a decidir en ella. En Próximas la fecha ya está en el
 * encabezado del día y el estado siempre es "Próxima"; en Pendientes todas esperan resultado: esas
 * columnas solo repetían información.
 */
export const COLUMNAS_VISTA: Record<VistaAudiencias, string[]> = {
  proximas: ['Hora', 'Usuaria', 'Proceso', 'Responsable'],
  pendientes: ['Fue el', 'Usuaria', 'Proceso', 'Responsable'],
  historial: ['Fecha', 'Usuaria', 'Proceso', 'Responsable', 'Estado'],
}

interface TablaAudienciasProps {
  items: AudienciaFilaDto[] | null
  vista: VistaAudiencias
  /** Recargando con datos a la vista: se atenúan en vez de desaparecer. */
  atenuada: boolean
  onAccion: (accion: AccionAudiencia, audiencia: AudienciaFilaDto) => void
}

function FilasEsqueleto({ columnas }: { columnas: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, indice) => (
        <tr key={indice} className="border-t border-gray-100">
          {Array.from({ length: columnas }, (_, columna) => (
            <td key={columna} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function textoCantidad(total: number): string {
  return `${total} ${total === 1 ? 'audiencia' : 'audiencias'}`
}

/** Próximas se agrupa por día con "Hoy" resaltado; las otras pestañas son una lista corrida. */
export default function TablaAudiencias({ items, vista, atenuada, onAccion }: TablaAudienciasProps) {
  const columnas = COLUMNAS_VISTA[vista]
  const fila = (audiencia: AudienciaFilaDto) => (
    <FilaAudiencia key={audiencia.id} audiencia={audiencia} vista={vista} onAccion={onAccion} />
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="bg-gray-50 text-xs font-medium text-gray-500">
          <tr>
            {columnas.map((columna) => (
              <th key={columna} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                {columna}
              </th>
            ))}
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className={atenuada ? 'opacity-60' : undefined}>
          {!items && <FilasEsqueleto columnas={columnas.length + 1} />}
          {items && vista !== 'proximas' && items.map(fila)}
          {items &&
            vista === 'proximas' &&
            agruparPorDia(items, hoyGT()).map((grupo, indice) => (
              <Fragment key={grupo.fecha}>
                <tr className={indice > 0 ? 'border-t-8 border-gray-50' : undefined}>
                  <th
                    scope="colgroup"
                    colSpan={columnas.length + 1}
                    className={`border-b px-4 pb-3 pt-4 text-left font-normal ${
                      grupo.esHoy ? 'border-brand-100 bg-brand-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {/* Hoja de calendario: el número del día se distingue de un vistazo al bajar por la lista. */}
                      <span
                        aria-hidden="true"
                        className={`flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 leading-none ${
                          grupo.esHoy ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'
                        }`}
                      >
                        <span className={`text-[10px] font-semibold uppercase ${grupo.esHoy ? 'text-brand-100' : 'text-gray-500'}`}>
                          {grupo.mesCorto}
                        </span>
                        <span className="mt-0.5 text-lg font-semibold tabular-nums">{grupo.dia}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-base font-semibold ${grupo.esHoy ? 'text-brand-800' : 'text-gray-900'}`}>
                          {grupo.titulo}
                        </span>
                        <span className="block text-sm text-gray-600">{grupo.subtitulo}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          grupo.esHoy ? 'bg-white text-brand-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {textoCantidad(grupo.items.length)}
                      </span>
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
