import Button from '../../../components/ui/Button'
import type { SesionesDelProceso } from './contextoDetalle'

/** "Cargar anteriores" de las dos pestañas: las sesiones llegan por páginas, de la más reciente atrás. */
export default function PieSesiones({ sesiones }: { sesiones: SesionesDelProceso }) {
  if (!sesiones.hayMas && !sesiones.errorMas) return null
  return (
    <div className="flex flex-wrap items-center gap-3">
      {sesiones.hayMas && (
        <Button variante="secondary" cargando={sesiones.cargandoMas} onClick={sesiones.cargarMas}>
          Cargar anteriores
        </Button>
      )}
      {sesiones.errorMas && (
        <p role="alert" className="text-sm text-red-600">
          {sesiones.errorMas}
        </p>
      )}
    </div>
  )
}
