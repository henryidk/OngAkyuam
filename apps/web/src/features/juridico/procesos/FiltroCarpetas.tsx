import { Folder, FolderOpen, Layers } from 'lucide-react'
import type { OpcionesCarpetas } from './formato'

/** Años con chip propio; los más antiguos van en un desplegable para que la fila no se desborde. */
const CARPETAS_VISIBLES = 5

const CLASE_FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'

function claseChip(elegida: boolean): string {
  return `inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${CLASE_FOCO} ${
    elegida
      ? 'border-brand-600 bg-brand-50 text-brand-700'
      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
  }`
}

function Contador({ total }: { total: number | null }) {
  if (total === null) return null
  return <span className="rounded bg-black/5 px-1.5 text-xs tabular-nums">{total}</span>
}

interface FiltroCarpetasProps {
  opciones: OpcionesCarpetas
  /** `null` es "Todos". */
  activa: number | null
  onCambiar: (anio: number | null) => void
}

/**
 * Carpetas por año del expediente, como los separadores de un archivo físico: un caso de 2014 que
 * sigue abierto (o se retomó) vive en la carpeta 2014, no en la del año en curso.
 */
export default function FiltroCarpetas({ opciones, activa, onCambiar }: FiltroCarpetasProps) {
  const visibles = opciones.carpetas.slice(0, CARPETAS_VISIBLES)
  const anteriores = opciones.carpetas.slice(CARPETAS_VISIBLES)
  const activaEnAnteriores = anteriores.some((carpeta) => carpeta.anio === activa)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Carpeta por año del expediente">
      <span className="mr-1 text-[13px] font-medium text-gray-600">Año del expediente</span>
      <button type="button" aria-pressed={activa === null} onClick={() => onCambiar(null)} className={claseChip(activa === null)}>
        <Layers size={15} aria-hidden="true" />
        Todos
        <Contador total={opciones.todos} />
      </button>
      {visibles.map(({ anio, total, esAnioActual }) => {
        const elegida = anio === activa
        const Icono = elegida ? FolderOpen : Folder
        return (
          <button key={anio} type="button" aria-pressed={elegida} onClick={() => onCambiar(anio)} className={claseChip(elegida)}>
            <Icono size={15} aria-hidden="true" />
            <span className="tabular-nums">{anio}</span>
            {esAnioActual && <span className="text-xs font-normal text-gray-500">(este año)</span>}
            <Contador total={total} />
          </button>
        )
      })}
      {anteriores.length > 0 && (
        <label>
          <span className="sr-only">Años anteriores</span>
          <select
            value={activaEnAnteriores ? String(activa) : ''}
            onChange={(evento) => onCambiar(evento.target.value ? Number(evento.target.value) : null)}
            className={`${claseChip(activaEnAnteriores)} cursor-pointer`}
          >
            <option value="">Años anteriores…</option>
            {anteriores.map(({ anio, total }) => (
              <option key={anio} value={anio}>
                {total === null ? anio : `${anio} (${total})`}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
