import { Search } from 'lucide-react'
import { BUSQUEDA_PACIENTES_MEDICA_MAX, hoyGT } from '@akyuam/shared'
import { CLASE_CAMPO, CLASE_SECCION } from '../../compartido/estilos'

interface FiltrosHistorialProps {
  desde: string
  hasta: string
  texto: string
  errorRango: string | null
  setDesde: (fecha: string) => void
  setHasta: (fecha: string) => void
  setTexto: (texto: string) => void
}

/** Rango de fechas y búsqueda por nombre, DPI o expediente. */
export default function FiltrosHistorial({ desde, hasta, texto, errorRango, setDesde, setHasta, setTexto }: FiltrosHistorialProps) {
  const hoy = hoyGT()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <span className={CLASE_SECCION}>Buscar paciente</span>
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa4b0]" />
            <input
              type="search"
              value={texto}
              maxLength={BUSQUEDA_PACIENTES_MEDICA_MAX}
              autoComplete="off"
              placeholder="Nombre, DPI o expediente"
              onChange={(evento) => setTexto(evento.target.value)}
              className={`${CLASE_CAMPO} pl-9`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASE_SECCION}>Desde</span>
          <input type="date" value={desde} max={hoy} onChange={(evento) => evento.target.value && setDesde(evento.target.value)} className={CLASE_CAMPO} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASE_SECCION}>Hasta</span>
          <input type="date" value={hasta} max={hoy} onChange={(evento) => evento.target.value && setHasta(evento.target.value)} className={CLASE_CAMPO} />
        </label>
      </div>
      {errorRango && (
        <p role="alert" className="text-[12.5px] text-[#9b2c20]">
          {errorRango}
        </p>
      )}
    </div>
  )
}
