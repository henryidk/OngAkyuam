import type { AudienciaOcupadaDto } from '@akyuam/shared'

interface AgendaDelDiaProps {
  ocupadas: AudienciaOcupadaDto[] | null
  cargando: boolean
  error: string | null
  /** La que se está reprogramando: se marca para que no parezca otra ocupación. */
  propiaId?: string
}

/** Lo que la responsable ya tiene ese día ("09:00 · 03-2026 · Conciliación"), antes de guardar. */
export default function AgendaDelDia({ ocupadas, cargando, error, propiaId }: AgendaDelDiaProps) {
  let contenido
  if (error) {
    contenido = <p className="text-red-700">No se pudo consultar la agenda de ese día. Puede guardar igual.</p>
  } else if (cargando || !ocupadas) {
    contenido = <p className="text-gray-500">{cargando ? 'Consultando la agenda…' : 'Elija la responsable y la fecha.'}</p>
  } else if (ocupadas.length === 0) {
    contenido = <p className="text-gray-600">No tiene otras audiencias ese día.</p>
  } else {
    contenido = (
      <ul className="space-y-0.5 text-gray-700">
        {ocupadas.map((ocupada) => (
          <li key={ocupada.id} className="tabular-nums">
            {ocupada.hora} · {ocupada.codigoProceso}
            {ocupada.descripcion && ` · ${ocupada.descripcion}`}
            {ocupada.id === propiaId && <span className="text-gray-500"> (la que se reprograma)</span>}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-gray-600">Agenda de la responsable ese día</p>
      <div aria-live="polite">{contenido}</div>
    </div>
  )
}
