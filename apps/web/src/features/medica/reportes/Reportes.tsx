import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatFechaGT, hoyGT, mesActualGT, nombreMesGT, type PeriodoMedica } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarReportes, obtenerReportes } from '../api/medica.api'
import { CLASE_EYEBROW, CLASE_H1, CLASE_TARJETA } from '../compartido/estilos'
import BarrasPorMes from './BarrasPorMes'
import TablaDesglose from './TablaDesglose'

const DESGLOSES: { clave: keyof PeriodoMedica['desgloses']; titulo: string; nota: string }[] = [
  { clave: 'rangoEdad', titulo: 'Personas por rango de edad', nota: 'Usuarias e hijos atendidos' },
  { clave: 'grupoEtnico', titulo: 'Personas por grupo étnico', nota: 'Según registro de Trabajo Social' },
  { clave: 'tipologia', titulo: 'Personas por tipología (Ley 22-2008)', nota: 'Una persona puede tener más de una' },
  { clave: 'municipio', titulo: 'Personas por municipio', nota: 'Ubicación geográfica registrada' },
]

function leerEntero(valor: string | null, minimo: number, maximo: number): number | null {
  const numero = Number(valor)
  return valor && Number.isInteger(numero) && numero >= minimo && numero <= maximo ? numero : null
}

/** Reportes de Medicina: solo cifras agregadas del año (o de un mes), nunca datos de una persona. */
export default function Reportes() {
  useTituloPagina({ titulo: 'Reportes' })
  const { mostrar } = useToast()
  const [params, setParams] = useSearchParams()
  // Se fija al abrir la página: el "año actual" no cambia a medio uso aunque pase la medianoche.
  const [actual] = useState(mesActualGT)
  const anio = leerEntero(params.get('anio'), 2000, actual.anio) ?? actual.anio
  const mes = leerEntero(params.get('mes'), 1, 12)
  const [descargando, setDescargando] = useState(false)

  const cargar = useCallback(() => obtenerReportes(anio), [anio])
  const { datos: reporte, error, recargar } = useRecurso(cargar)

  function cambiar(nuevoAnio: number, nuevoMes: number | null) {
    setParams(
      () => {
        const nuevos = new URLSearchParams()
        if (nuevoAnio !== actual.anio) nuevos.set('anio', String(nuevoAnio))
        if (nuevoMes !== null) nuevos.set('mes', String(nuevoMes))
        return nuevos
      },
      { replace: true },
    )
  }

  async function descargar() {
    setDescargando(true)
    try {
      const contenido = await descargarReportes(anio)
      guardarArchivo(contenido, `medicina_${anio}.xlsx`)
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      mostrar('No se pudo generar el Excel. Intenta de nuevo.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  const esAnioActual = anio === actual.anio
  const ultimoMes = esAnioActual ? actual.mes : 12
  const mesValido = mes !== null && mes <= ultimoMes ? mes : null
  const periodo = reporte ? (mesValido === null ? reporte.anual : reporte.meses[mesValido - 1]) : null
  const aniosDisponibles = reporte ? [...new Set([...reporte.aniosDisponibles, actual.anio])].sort((a, b) => a - b) : [anio]

  const titulo = mesValido === null ? `Atención médica ${anio}` : `${nombreMesGT(mesValido)} ${anio}`
  const subtitulo =
    mesValido !== null
      ? 'Haz clic en otro mes o vuelve al año completo'
      : esAnioActual
        ? `Enero a ${nombreMesGT(actual.mes).toLowerCase()} · datos al ${formatFechaGT(hoyGT())}`
        : 'Año completo'

  const kpis = periodo
    ? [
        { etiqueta: 'Consultas', valor: String(periodo.consultas), detalle: 'Usuarias e hijos' },
        { etiqueta: 'Personas atendidas', valor: String(periodo.personasAtendidas), detalle: 'Distintas, sin repetir' },
        {
          etiqueta: 'Consultas por persona',
          valor: (periodo.consultas / Math.max(periodo.personasAtendidas, 1)).toFixed(1),
          detalle: 'Promedio',
        },
        { etiqueta: 'Primeras consultas', valor: String(periodo.primerasConsultas), detalle: 'Atenciones nuevas' },
        { etiqueta: 'En atención ahora', valor: String(reporte!.enAtencionAhora), detalle: `Al ${formatFechaGT(hoyGT())}` },
      ]
    : []

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className={CLASE_EYEBROW}>Reportes</p>
          <h1 className={CLASE_H1}>{titulo}</h1>
          <p className="text-sm text-[#5b6573]">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Año" className="flex overflow-hidden rounded-md border border-[#d5dadf] bg-white">
            {aniosDisponibles.map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={opcion === anio}
                onClick={() => cambiar(opcion, null)}
                className={`px-3.5 py-2 text-[13px] font-semibold tabular-nums ${
                  opcion === anio ? 'bg-[#1c1640] text-white' : 'bg-white text-[#374151] hover:bg-[#f8f9fa]'
                }`}
              >
                {opcion}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={descargando || !reporte}
            onClick={() => void descargar()}
            className="whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
          >
            {descargando ? 'Generando…' : 'Descargar Excel'}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los reportes" onReintentar={() => void recargar()} />
      ) : !reporte || !periodo ? (
        <Esqueleto filas={5} />
      ) : (
        <>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-2.5">
            {kpis.map((kpi) => (
              <div key={kpi.etiqueta} className={`${CLASE_TARJETA} flex flex-col gap-1 rounded-lg px-4 py-3.5`}>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-[#5b6573]">{kpi.etiqueta}</dt>
                <dd className="text-[26px] font-semibold leading-[1.1] tabular-nums text-[#1c2430]">{kpi.valor}</dd>
                <dd className="text-xs text-[#5b6573]">{kpi.detalle}</dd>
              </div>
            ))}
          </dl>

          <BarrasPorMes meses={reporte.meses} mes={mesValido} ultimoMes={ultimoMes} onElegir={(nuevo) => cambiar(anio, nuevo)} />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
            {DESGLOSES.map((desglose) => (
              <TablaDesglose key={desglose.clave} titulo={desglose.titulo} nota={desglose.nota} filas={periodo.desgloses[desglose.clave]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
