import { anioActualGT, type IndicadoresPsicologia } from '@akyuam/shared'
import { porcentajeInasistencia } from './calculos'

interface Kpi {
  etiqueta: string
  valor: string | number
  detalle: string
  color: string
}

/** En el año en curso importa lo que sigue abierto; en uno pasado, lo que se cerró. */
function kpiDeProcesos(datos: IndicadoresPsicologia): Kpi {
  if (datos.anio === anioActualGT()) {
    return {
      etiqueta: 'Procesos activos',
      valor: datos.procesosActivos,
      detalle: 'en Inicio o Seguimiento',
      color: 'text-brand-600',
    }
  }
  return {
    etiqueta: 'Procesos cerrados',
    valor: datos.procesosCerradosEnElAnio,
    detalle: `en ${datos.anio}`,
    color: 'text-green-800',
  }
}

function kpisDe(datos: IndicadoresPsicologia): Kpi[] {
  const { anual, anio } = datos
  return [
    kpiDeProcesos(datos),
    { etiqueta: 'Personas atendidas', valor: anual.personasAtendidas, detalle: `en ${anio}`, color: 'text-gray-900' },
    {
      etiqueta: 'Sesiones realizadas',
      valor: anual.sesionesRealizadas,
      detalle: 'incluye hijos/as',
      color: 'text-gray-900',
    },
    {
      etiqueta: 'Inasistencia',
      valor: `${porcentajeInasistencia(anual)}%`,
      detalle: anual.inasistencias === 1 ? '1 cita sin asistir' : `${anual.inasistencias} citas sin asistir`,
      color: 'text-amber-800',
    },
  ]
}

/** Las cuatro cifras del año. No cambian al elegir un mes: son el marco de todo lo demás. */
export default function TarjetasKpi({ datos }: { datos: IndicadoresPsicologia }) {
  return (
    <dl className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
      {kpisDe(datos).map((kpi) => (
        <div key={kpi.etiqueta} className="flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-3.5">
          <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-500">{kpi.etiqueta}</dt>
          <dd className={`text-[26px] font-semibold leading-none ${kpi.color}`}>{kpi.valor}</dd>
          <dd className="text-[12.5px] text-gray-500">{kpi.detalle}</dd>
        </div>
      ))}
    </dl>
  )
}
