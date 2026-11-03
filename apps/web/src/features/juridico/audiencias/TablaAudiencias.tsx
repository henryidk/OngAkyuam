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
            agruparPorDia(items, hoyGT()).map((grupo) => (
              <Fragment key={grupo.fecha}>
                <tr className={`border-t border-gray-200 ${grupo.esHoy ? 'bg-brand-50' : 'bg-gray-50/70'}`}>
                  <th scope="colgroup" colSpan={columnas.length + 1} className="px-4 py-2 text-left">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`text-sm font-semibold ${grupo.esHoy ? 'text-brand-700' : 'text-gray-800'}`}>
                        {grupo.etiqueta}
                        {grupo.detalle && <span className="ml-2 font-normal text-gray-500">{grupo.detalle}</span>}
                      </span>
                      <span className="text-xs font-normal text-gray-500">{textoCantidad(grupo.items.length)}</span>
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
