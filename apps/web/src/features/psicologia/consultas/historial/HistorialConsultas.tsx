import { useSearchParams } from 'react-router-dom'
import Button from '../../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import DrawerConsulta from './DrawerConsulta'
import FilaHistorial from './FilaHistorial'
import FiltrosHistorial from './FiltrosHistorial'
import { useHistorialConsultas } from './useHistorialConsultas'

/** Consultas › Historial: las sesiones realizadas (atendidas y no asistidas), de la más reciente atrás. */
export default function HistorialConsultas() {
  const [params, setParams] = useSearchParams()
  const { filtros, cambiar, limpiar, hayFiltros, errorRango, conBusqueda, items, error, cargando, hayMas, cargarMas, cargandoMas, errorMas, recargar } =
    useHistorialConsultas()

  // La sesión abierta vive en la URL como id (`?consulta=`): recargar o volver atrás la respeta.
  const abierta = params.get('consulta')
  function abrir(citaId: string | null) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales)
        if (citaId) nuevos.set('consulta', citaId)
        else nuevos.delete('consulta')
        return nuevos
      },
      { replace: true },
    )
  }

  const total = items?.length ?? 0
  const textoTotal = `${total}${hayMas ? '+' : ''} ${total === 1 && !hayMas ? 'sesión' : 'sesiones'}`

  return (
    <div className="space-y-4">
      <FiltrosHistorial filtros={filtros} errorRango={errorRango} cambiar={cambiar} />

      <div className="flex min-h-8 flex-wrap items-center gap-3 text-sm text-gray-600">
        {/* El total se anuncia al cambiar los filtros sin mover el foco. */}
        <p role="status" aria-live="polite">
          {items && !errorRango ? textoTotal : ''}
        </p>
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="font-medium text-brand-700 hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {errorRango ? null : error && !items ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el historial" onReintentar={() => void recargar()} />
      ) : !items ? (
        <Esqueleto filas={4} />
      ) : items.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          <p>{hayFiltros || conBusqueda ? 'No hay sesiones con estos filtros.' : 'No hay sesiones registradas en el último mes.'}</p>
          {hayFiltros && (
            <Button variante="secondary" onClick={limpiar}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul
            className={`divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white ${cargando ? 'opacity-60' : ''}`}
          >
            {items.map((sesion) => (
              <FilaHistorial key={sesion.citaId} sesion={sesion} onAbrir={() => abrir(sesion.citaId)} />
            ))}
          </ul>
          {hayMas && (
            <div className="flex flex-col items-center gap-1.5">
              <Button variante="secondary" cargando={cargandoMas} onClick={() => void cargarMas()}>
                Cargar más
              </Button>
              {errorMas && (
                <p role="alert" className="text-sm text-red-600">
                  {errorMas}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {abierta && <DrawerConsulta key={abierta} citaId={abierta} onCerrar={() => abrir(null)} />}
    </div>
  )
}
