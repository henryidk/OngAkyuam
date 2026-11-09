import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import {
  ALCANCES_REPORTE_MEDICA,
  ETIQUETAS_ALCANCE_REPORTE_MEDICA,
  ETIQUETAS_PERSONA_REPORTE_MEDICA,
  formatFechaGT,
  MESES_MAXIMOS_REPORTE_MEDICA,
  mesesQueAbarca,
  nombreMesGT,
  PERSONAS_REPORTE_MEDICA,
  type AlcanceReporteMedica,
  type IndicadoresMedica,
  type PeriodoMedica,
  type PersonaReporteMedica,
  type ReportesMedicaQuery,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarReportes, obtenerReportes } from '../api/medica.api'
import { CLASE_CAMPO, CLASE_TARJETA } from '../compartido/estilos'
import BarrasPorMes from './BarrasPorMes'
import type { Periodo } from './SelectorPeriodo'
import TablaDesglose from './TablaDesglose'

type Filtros = Pick<ReportesMedicaQuery, 'persona' | 'alcance' | 'soloPrimeras'>

const FILTROS_INICIALES: Filtros = { persona: 'TODAS', alcance: 'TODO', soloPrimeras: false }

const DESGLOSES: { clave: keyof PeriodoMedica['desgloses']; titulo: string }[] = [
  { clave: 'rangoEdad', titulo: 'Rango de edad' },
  { clave: 'grupoEtnico', titulo: 'Grupo étnico' },
  { clave: 'tipologia', titulo: 'Tipología (Ley 22-2008)' },
  { clave: 'municipio', titulo: 'Municipio' },
]

/** Una sola aclaración para los cuatro desgloses, en vez de una nota por tarjeta. */
const NOTA_DESGLOSES =
  'Datos del registro de Trabajo Social. La edad es la de su primera consulta del periodo; una persona puede tener más de una tipología.'


const CLASE_ETIQUETA = 'flex flex-col gap-1 text-xs font-medium text-texto-suave'

function Kpi({ etiqueta, valor, detalle, color = 'text-texto' }: { etiqueta: string; valor: ReactNode; detalle: string; color?: string }) {
  return (
    <div className={`${CLASE_TARJETA} flex flex-col gap-1.5 rounded-lg px-4 py-3.5`}>
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
      <dd className={`text-[26px] font-semibold leading-none tabular-nums ${color}`}>{valor}</dd>
      <dd className="text-[12.5px] text-texto-suave">{detalle}</dd>
    </div>
  )
}

function Contenido({ reporte, filtros, hoy }: { reporte: IndicadoresMedica; filtros: Filtros; hoy: string }) {
  // Posición del mes elegido en la gráfica; null = todo el periodo. Se reinicia al cambiar el reporte (key del padre).
  const [elegido, setElegido] = useState<number | null>(null)
  const mesElegido = elegido !== null ? (reporte.meses[elegido] ?? null) : null
  const periodo = mesElegido ?? reporte.total
  const enQue = mesElegido
    ? `en ${nombreMesGT(mesElegido.mes).toLowerCase()} ${mesElegido.anio}`
    : `del ${formatFechaGT(reporte.desde)} al ${formatFechaGT(reporte.hasta)}`
  const porPersona = (periodo.consultas / Math.max(periodo.personasAtendidas, 1)).toFixed(1)

  return (
    <>
      <dl className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        <Kpi etiqueta="Personas atendidas" valor={periodo.personasAtendidas} detalle={ETIQUETAS_PERSONA_REPORTE_MEDICA[filtros.persona]} />
        <Kpi etiqueta="Consultas" valor={periodo.consultas} detalle={`${porPersona} por persona`} />
        <Kpi etiqueta="Primeras consultas" valor={periodo.primerasConsultas} detalle="Atenciones nuevas" />
        <Kpi etiqueta="En atención hoy" valor={reporte.enAtencionAhora} detalle={`Al ${formatFechaGT(hoy)}`} color="text-brand-600" />
      </dl>

      {reporte.meses.length > 1 && <BarrasPorMes meses={reporte.meses} elegido={elegido} onElegir={setElegido} />}

      <section aria-labelledby="titulo-desgloses" className="flex flex-col gap-2.5">
        <h2 id="titulo-desgloses" className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
          Quiénes se atendieron {enQue}
        </h2>
        <div className="grid items-start gap-3.5 md:grid-cols-2">
          {DESGLOSES.map((desglose) => (
            <TablaDesglose key={desglose.clave} titulo={desglose.titulo} filas={periodo.desgloses[desglose.clave]} />
          ))}
        </div>
        <p className="text-xs text-texto-suave">{NOTA_DESGLOSES}</p>
      </section>
    </>
  )
}

/** Indicadores del periodo con sus filtros propios (no aplican al formato de la ONG). Pantalla y Excel usan lo mismo. */
export default function PanelIndicadores({ periodo, hoy }: { periodo: Periodo; hoy: string }) {
  const { mostrar } = useToast()
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [descargando, setDescargando] = useState(false)

  const demasiadoLargo = mesesQueAbarca(periodo.desde, periodo.hasta) > MESES_MAXIMOS_REPORTE_MEDICA
  const consulta = useMemo<ReportesMedicaQuery>(() => ({ ...periodo, ...filtros }), [periodo, filtros])
  const cargar = useCallback(
    // Con más de 12 meses no se pide: la pantalla ya explica por qué.
    () => (demasiadoLargo ? Promise.resolve(null) : obtenerReportes(consulta)),
    [consulta, demasiadoLargo],
  )
  const { datos: reporte, error, recargar } = useRecurso(cargar)

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

  const cambiados = filtros.persona !== 'TODAS' || filtros.alcance !== 'TODO' || filtros.soloPrimeras

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Una sola barra: los filtros propios de los indicadores a la izquierda y su descarga a la derecha. */}
      <section aria-label="Filtros de los indicadores" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className={CLASE_ETIQUETA}>
            Quién se atendió
            <select
              value={filtros.persona}
              onChange={(evento) => setFiltros({ ...filtros, persona: evento.target.value as PersonaReporteMedica })}
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
            Quién registró
            <select
              value={filtros.alcance}
              onChange={(evento) => setFiltros({ ...filtros, alcance: evento.target.value as AlcanceReporteMedica })}
              className={`${CLASE_CAMPO} py-1.5`}
            >
              {ALCANCES_REPORTE_MEDICA.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS_ALCANCE_REPORTE_MEDICA[opcion]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-[13px] text-texto">
            <input
              type="checkbox"
              checked={filtros.soloPrimeras}
              onChange={(evento) => setFiltros({ ...filtros, soloPrimeras: evento.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            Solo primeras consultas
          </label>
          {cambiados && (
            <button
              type="button"
              onClick={() => setFiltros(FILTROS_INICIALES)}
              className="pb-2 text-[13px] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Quitar filtros
            </button>
          )}
        </div>
        <Button
          variante="secondary"
          tamano="md"
          cargando={descargando}
          disabled={!reporte || demasiadoLargo}
          title="Una columna por mes del periodo, con estos filtros anotados al pie"
          onClick={() => void descargar()}
        >
          {!descargando && <Download aria-hidden="true" className="h-4 w-4" />}
          {descargando ? 'Generando…' : 'Descargar indicadores (Excel)'}
        </Button>
      </section>

      {demasiadoLargo ? (
        <p className="rounded-lg border border-estado-pendiente-borde bg-estado-pendiente-insignia px-4 py-3 text-[13px] text-estado-pendiente">
          Los indicadores abarcan como máximo {MESES_MAXIMOS_REPORTE_MEDICA} meses (son las columnas del Excel). Acorta el periodo
          de arriba para verlos; el informe de la ONG sí acepta este periodo.
        </p>
      ) : error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los indicadores" onReintentar={() => void recargar()} />
      ) : !reporte ? (
        <Esqueleto filas={5} />
      ) : (
        <Contenido key={`${consulta.desde}|${consulta.hasta}|${filtros.persona}|${filtros.alcance}|${filtros.soloPrimeras}`} reporte={reporte} filtros={filtros} hoy={hoy} />
      )}
    </div>
  )
}
