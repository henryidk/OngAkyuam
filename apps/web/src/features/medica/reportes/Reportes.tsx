import { useCallback, useState } from 'react'
import {
  ALCANCES_REPORTE_MEDICA,
  ETIQUETAS_ALCANCE_REPORTE_MEDICA,
  ETIQUETAS_PERSONA_REPORTE_MEDICA,
  formatFechaGT,
  hoyGT,
  nombreMesGT,
  PERSONAS_REPORTE_MEDICA,
  reportesMedicaQuerySchema,
  type AlcanceReporteMedica,
  type PeriodoMedica,
  type PersonaReporteMedica,
  type ReportesMedicaQuery,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarReportes, obtenerReportes } from '../api/medica.api'
import { CLASE_CAMPO, CLASE_EYEBROW, CLASE_H1, CLASE_TARJETA } from '../compartido/estilos'
import BarrasPorMes from './BarrasPorMes'
import InformeAtencion from './InformeAtencion'
import TablaDesglose from './TablaDesglose'

const DESGLOSES: { clave: keyof PeriodoMedica['desgloses']; titulo: string; nota: string }[] = [
  { clave: 'rangoEdad', titulo: 'Personas por rango de edad', nota: 'Edad al día de su primera consulta del periodo' },
  { clave: 'grupoEtnico', titulo: 'Personas por grupo étnico', nota: 'Según registro de Trabajo Social' },
  { clave: 'tipologia', titulo: 'Personas por tipología (Ley 22-2008)', nota: 'Una persona puede tener más de una' },
  { clave: 'municipio', titulo: 'Personas por municipio', nota: 'Ubicación geográfica registrada' },
]

const CLASE_ETIQUETA = 'flex flex-col gap-1 text-xs font-medium text-[#5b6573]'

/**
 * Reportes de Medicina: el informe de atención con el formato de la ONG y los indicadores de un
 * periodo. La pantalla y el Excel usan el mismo periodo y filtros, que viven en el estado de la
 * pantalla (no en la URL). Solo cifras agregadas, nunca datos de una persona.
 */
export default function Reportes() {
  useTituloPagina({ titulo: 'Reportes' })
  const { mostrar } = useToast()
  // Se fija al abrir la página: "hoy" no cambia a medio uso aunque pase la medianoche.
  const [hoy] = useState(hoyGT)
  // Por defecto, el año en curso hasta hoy.
  const [campos, setCampos] = useState<ReportesMedicaQuery>(() => ({
    desde: `${hoy.slice(0, 4)}-01-01`,
    hasta: hoy,
    persona: 'TODAS',
    alcance: 'TODO',
    soloPrimeras: false,
  }))
  const [consulta, setConsulta] = useState(campos)
  // Posición del mes elegido en la gráfica; null = todo el periodo.
  const [elegido, setElegido] = useState<number | null>(null)
  const [descargando, setDescargando] = useState(false)

  const valido = reportesMedicaQuerySchema.safeParse(campos)
  const cargar = useCallback(() => obtenerReportes(consulta), [consulta])
  const { datos: reporte, error, recargar } = useRecurso(cargar)

  function cambiar(cambios: Partial<ReportesMedicaQuery>) {
    const nuevos = { ...campos, ...cambios }
    setCampos(nuevos)
    // Solo se pide con un periodo válido; mientras tanto se sigue viendo el anterior.
    if (reportesMedicaQuerySchema.safeParse(nuevos).success) {
      setConsulta(nuevos)
      setElegido(null)
    }
  }

  async function descargar() {
    setDescargando(true)
    try {
      guardarArchivo(await descargarReportes(consulta), `medicina-indicadores_${consulta.desde}_${consulta.hasta}.xlsx`)
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      mostrar('No se pudo generar el Excel. Intenta de nuevo.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  const mesElegido = reporte && elegido !== null ? (reporte.meses[elegido] ?? null) : null
  const periodo = reporte ? (mesElegido ?? reporte.total) : null
  const subtitulo = mesElegido
    ? `${nombreMesGT(mesElegido.mes)} ${mesElegido.anio} · haz clic en otro mes o vuelve a todo el periodo`
    : `Del ${formatFechaGT(consulta.desde)} al ${formatFechaGT(consulta.hasta)}`

  const kpis = periodo
    ? [
        { etiqueta: 'Consultas', valor: String(periodo.consultas), detalle: ETIQUETAS_PERSONA_REPORTE_MEDICA[consulta.persona] },
        { etiqueta: 'Personas atendidas', valor: String(periodo.personasAtendidas), detalle: 'Distintas, sin repetir' },
        {
          etiqueta: 'Consultas por persona',
          valor: (periodo.consultas / Math.max(periodo.personasAtendidas, 1)).toFixed(1),
          detalle: 'Promedio',
        },
        { etiqueta: 'Primeras consultas', valor: String(periodo.primerasConsultas), detalle: 'Atenciones nuevas' },
        { etiqueta: 'En atención ahora', valor: String(reporte!.enAtencionAhora), detalle: `Toda el área, al ${formatFechaGT(hoy)}` },
      ]
    : []

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-[18px]">
      <InformeAtencion />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className={CLASE_EYEBROW}>Indicadores</p>
          <h1 className={CLASE_H1}>Atención médica</h1>
          <p className="text-sm text-[#5b6573]">{subtitulo}</p>
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

      <div className={`${CLASE_TARJETA} flex flex-col gap-2 px-5 py-3.5`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className={CLASE_ETIQUETA}>
            Desde
            <input
              type="date"
              value={campos.desde}
              max={hoy}
              onChange={(evento) => cambiar({ desde: evento.target.value })}
              className={`${CLASE_CAMPO} w-[150px] py-1.5`}
            />
          </label>
          <label className={CLASE_ETIQUETA}>
            Hasta
            <input
              type="date"
              value={campos.hasta}
              max={hoy}
              onChange={(evento) => cambiar({ hasta: evento.target.value })}
              className={`${CLASE_CAMPO} w-[150px] py-1.5`}
            />
          </label>
          <label className={CLASE_ETIQUETA}>
            Personas
            <select
              value={campos.persona}
              onChange={(evento) => cambiar({ persona: evento.target.value as PersonaReporteMedica })}
              className={`${CLASE_CAMPO} py-1.5`}
            >
              {PERSONAS_REPORTE_MEDICA.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS_PERSONA_REPORTE_MEDICA[opcion]}
                </option>
              ))}
            </select>
          </label>
          <label className={CLASE_ETIQUETA}>
            Personal
            <select
              value={campos.alcance}
              onChange={(evento) => cambiar({ alcance: evento.target.value as AlcanceReporteMedica })}
              className={`${CLASE_CAMPO} py-1.5`}
            >
              {ALCANCES_REPORTE_MEDICA.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS_ALCANCE_REPORTE_MEDICA[opcion]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-[13px] text-[#1c2430]">
            <input
              type="checkbox"
              checked={campos.soloPrimeras}
              onChange={(evento) => cambiar({ soloPrimeras: evento.target.checked })}
              className="h-4 w-4 accent-[#7346a5]"
            />
            Solo primeras consultas
          </label>
        </div>
        {!valido.success ? (
          <p role="alert" className="text-[13px] text-[#9b2c20]">
            {valido.error.issues[0]?.message ?? 'Revisa las fechas.'}
          </p>
        ) : (
          <p className="text-xs text-[#5b6573]">El Excel se descarga con este mismo periodo y filtros, con una columna por mes.</p>
        )}
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

          <BarrasPorMes meses={reporte.meses} elegido={elegido} onElegir={setElegido} />

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
