import { useCallback, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { anioActualGT, nombreMes, sumarDiasGT, sumarMesesGT } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerIndicadores } from '../api/psicologia.api'
import BarrasPorMes from './BarrasPorMes'
import FiltrosIndicadores from './FiltrosIndicadores'
import { FILTROS_INICIALES, type FiltrosPsicologia } from './filtros'
import PanelPersonasAtendidas, { type Rango } from './PanelPersonasAtendidas'
import SelectorAnio from './SelectorAnio'
import TablaDesglose from './TablaDesglose'
import TarjetasKpi from './TarjetasKpi'

type Vista = 'estadisticas' | 'personas'

/** Rango del Excel por defecto: el año completo que se está viendo. */
function rangoDelAnio(anio: number): Rango {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}

/** Del día 1 al último día del mes (fechas de calendario, sin pasar por `Date`). */
function rangoDelMes(anio: number, mes: number): Rango {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  return { desde, hasta: sumarDiasGT(sumarMesesGT(desde, 1), -1) }
}

/** Para el subtítulo: de quién son las cifras que se están viendo. */
function describirAlcance(filtros: FiltrosPsicologia): string {
  return filtros.profesional === 'MIOS' ? 'Mis procesos' : 'Todos los procesos del equipo de Psicología'
}

/** Pestaña dentro de la página: el estado vive en `?vista=`, así sobrevive a recargar y al botón atrás. */
function BotonVista({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
        activa ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

/** Un grupo de desgloses con su título: separa "a quién" de "cómo" sin más cajas. */
function GrupoDesgloses({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</h2>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {children}
      </div>
    </section>
  )
}

/**
 * Reportes del módulo: cifras de un año (solo números, sin nombres) de mis procesos o de todos
 * los del equipo, en dos pestañas: "Estadísticas" y "Personas atendidas" (la tabla del Excel). Los
 * filtros de arriba aplican a las dos; el periodo de la tabla sigue al año o al mes elegido.
 */
export default function Indicadores() {
  const [anio, setAnio] = useState(anioActualGT)
  const [mes, setMes] = useState<number | null>(null)
  const [filtros, setFiltros] = useState<FiltrosPsicologia>(FILTROS_INICIALES)
  const [rango, setRango] = useState<Rango>(() => rangoDelAnio(anioActualGT()))
  // `null` = aún no se abrió la tabla con este periodo: la pestaña usa la cifra del año o mes.
  const [totalPersonas, setTotalPersonas] = useState<number | null>(null)
  const [parametros, setParametros] = useSearchParams()
  const vista: Vista = parametros.get('vista') === 'estadisticas' ? 'estadisticas' : 'personas'

  const cargar = useCallback(() => obtenerIndicadores({ anio, ...filtros }), [anio, filtros])
  const { datos, error, recargar } = useRecurso(cargar)

  function cambiarAnio(nuevo: number) {
    setAnio(nuevo)
    setMes(null)
    setRango(rangoDelAnio(nuevo))
    setTotalPersonas(null)
  }

  // Al elegir un mes, el Excel pasa a ese mes; al quitarlo, vuelve al año completo.
  function elegirMes(nuevo: number | null) {
    setMes(nuevo)
    setRango(nuevo === null ? rangoDelAnio(anio) : rangoDelMes(anio, nuevo))
    setTotalPersonas(null)
  }

  function cambiarFiltros(nuevos: FiltrosPsicologia) {
    setFiltros(nuevos)
    setTotalPersonas(null)
  }

  function cambiarVista(nueva: Vista) {
    setParametros(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales)
        // La tabla es la vista por defecto: solo "Estadísticas" deja huella en la URL.
        if (nueva === 'estadisticas') siguientes.set('vista', 'estadisticas')
        else siguientes.delete('vista')
        return siguientes
      },
      { replace: true },
    )
  }

  // Los desgloses siguen al mes elegido; las tarjetas de arriba siempre son del año.
  const periodo = datos ? (mes === null ? datos.anual : datos.meses[mes - 1]) : null
  const sufijoPeriodo = mes === null ? `en ${anio}` : `en ${nombreMes(mes).toLowerCase()}`
  const conteoPersonas = totalPersonas ?? periodo?.personasAtendidas

  return (
    <div className="mx-auto max-w-6xl space-y-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reportes</p>
          <h1 className="text-2xl font-semibold text-gray-900">Estadísticas de Psicología</h1>
          <p className="text-sm text-gray-500">
            {describirAlcance(filtros)} · edad, etnia y tipología vienen de Trabajo Social.
          </p>
        </div>
        <SelectorAnio anio={anio} anios={datos?.aniosDisponibles ?? [anio]} onCambiar={cambiarAnio} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <FiltrosIndicadores
          filtros={filtros}
          onCambiar={cambiarFiltros}
        />
      </section>

      <div role="tablist" aria-label="Vistas del reporte" className="flex gap-1 border-b border-gray-200">
        <BotonVista activa={vista === 'personas'} onClick={() => cambiarVista('personas')}>
          Personas atendidas
          {conteoPersonas !== undefined && (
            <span className="ml-1.5 font-medium text-gray-500 tabular-nums">{conteoPersonas}</span>
          )}
        </BotonVista>
        <BotonVista activa={vista === 'estadisticas'} onClick={() => cambiarVista('estadisticas')}>
          Estadísticas
        </BotonVista>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error.mensaje}</span>
          {!error.sinPermiso && (
            <Button variante="secondary" onClick={() => void recargar()}>
              Reintentar
            </Button>
          )}
        </div>
      )}

      {vista === 'estadisticas' && !error && !datos && <p className="text-sm text-gray-500">Cargando estadísticas…</p>}

      {vista === 'estadisticas' && datos && periodo && (
        <>
          <TarjetasKpi datos={datos} />
          <BarrasPorMes anio={anio} meses={datos.meses} mesSeleccionado={mes} onElegir={elegirMes} />
          <GrupoDesgloses titulo={`Quiénes se atendieron ${sufijoPeriodo}`}>
            <TablaDesglose titulo="Por rango de edad" filas={periodo.desgloses.rangoEdad} />
            <TablaDesglose titulo="Por grupo étnico" filas={periodo.desgloses.grupoEtnico} />
            <TablaDesglose titulo="Por tipología 22-2008" filas={periodo.desgloses.tipologia} />
          </GrupoDesgloses>
        </>
      )}

      {vista === 'personas' && (
        <PanelPersonasAtendidas
          filtros={filtros}
          rango={rango}
          onCambiarRango={setRango}
          onTotal={setTotalPersonas}
        />
      )}
    </div>
  )
}
