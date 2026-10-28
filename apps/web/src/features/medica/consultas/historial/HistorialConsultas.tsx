import { useSearchParams } from 'react-router-dom'
import { ErrorVista, Esqueleto } from '../../../../components/ui/EstadosVista'
import DrawerConsulta from './DrawerConsulta'
import FilaHistorial from './FilaHistorial'
import FiltrosHistorial from './FiltrosHistorial'
import { useHistorialConsultas } from './useHistorialConsultas'

/** Consultas › Historial: todas las consultas registradas, de la más reciente a la más antigua. */
export default function HistorialConsultas() {
  const [params, setParams] = useSearchParams()
  const { filtros, errorRango, conBusqueda, items, error, hayMas, cargarMas, cargandoMas, errorMas, recargar } =
    useHistorialConsultas()

  // El detalle abierto vive en la URL como id (`?consulta=`): recargar o volver atrás lo respeta.
  const consultaAbierta = params.get('consulta')
  function abrir(consultaId: string | null) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales)
        if (consultaId) nuevos.set('consulta', consultaId)
        else nuevos.delete('consulta')
        return nuevos
      },
      { replace: true },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FiltrosHistorial {...filtros} errorRango={errorRango} />

      {errorRango ? null : error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el historial" onReintentar={() => void recargar()} />
      ) : !items ? (
        <Esqueleto filas={4} />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d5dadf] bg-white p-8 text-center text-sm text-[#5b6573]">
          {conBusqueda ? 'Ninguna consulta coincide con la búsqueda en estas fechas.' : 'Sin consultas registradas en estas fechas.'}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
            {items.map((consulta) => (
              <FilaHistorial key={consulta.id} consulta={consulta} onAbrir={() => abrir(consulta.id)} />
            ))}
          </div>
          {hayMas && (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={cargandoMas}
                onClick={() => void cargarMas()}
                className="rounded-md border border-[#d5dadf] bg-white px-4 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
              >
                {cargandoMas ? 'Cargando…' : 'Cargar consultas más antiguas'}
              </button>
              {errorMas && <p className="text-[12.5px] text-[#9b2c20]">{errorMas}</p>}
            </div>
          )}
        </>
      )}

      {consultaAbierta && (
        <DrawerConsulta
          key={consultaAbierta}
          consultaId={consultaAbierta}
          fila={items?.find((consulta) => consulta.id === consultaAbierta)}
          onCerrar={() => abrir(null)}
        />
      )}
    </div>
  )
}
