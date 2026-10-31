import { useState } from 'react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  CATEGORIAS_PROCESO_JURIDICO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_FORMA_FINALIZACION,
  FORMAS_FINALIZACION_PROCESO,
  nombreMesGT,
  type InicioJuridicoDto,
} from '@akyuam/shared'
import { RUTAS_JURIDICO } from '../rutas'
import { CLASE_FOCO, Seccion, Vacio, plural } from './piezas'

/**
 * Abiertos y finalizados: el morado del estado "en trámite" y un verde más saturado que el del
 * estado finalizado, porque el de la etiqueta no pasa el mínimo de croma para una barra
 * (comprobado con el validador de paletas: ΔE 17 para daltonismo deutan).
 */
const COLOR_ABIERTOS = 'bg-[#7346a5]'
const COLOR_FINALIZADOS = 'bg-[#2f855a]'

/** Alto de la barra más alta del gráfico por mes, en px. */
const ALTO_GRAFICO = 96

function Muestra({ clase }: { clase: string }) {
  return <span className={`inline-block size-2.5 shrink-0 rounded-[3px] ${clase}`} aria-hidden="true" />
}

function Barra({ valor, maximo, clase }: { valor: number; maximo: number; clase: string }) {
  // Una barra en 0 no se dibuja: solo se ve la línea base.
  if (valor === 0) return <span className="w-full max-w-[9px]" />
  return (
    <span
      className={`block w-full max-w-[9px] rounded-t-[3px] ${clase}`}
      style={{ height: `${Math.max(3, (valor / maximo) * ALTO_GRAFICO)}px` }}
    />
  )
}

function textoMes(mes: { mes: number; abiertos: number; finalizados: number }): string {
  return `${nombreMesGT(mes.mes)}: ${plural(mes.abiertos, 'abierto', 'abiertos')} · ${plural(
    mes.finalizados,
    'finalizado',
    'finalizados',
  )}`
}

/** Mes a mes del año en curso; los meses que no han llegado quedan atenuados. */
function GraficoPorMes({ inicio, mesActual }: { inicio: InicioJuridicoDto; mesActual: number }) {
  const { porMes } = inicio.movimientoAnio
  const [elegido, setElegido] = useState<number | null>(null)
  const maximo = Math.max(1, ...porMes.flatMap((mes) => [mes.abiertos, mes.finalizados]))
  const visible = porMes[(elegido ?? mesActual) - 1]

  return (
    <figure className="px-4 pb-3.5">
      <div
        className="grid grid-cols-12 items-end gap-0.5 border-b border-gray-200"
        style={{ height: `${ALTO_GRAFICO + 4}px` }}
        onMouseLeave={() => setElegido(null)}
      >
        {porMes.map((mes) => {
          const futuro = mes.mes > mesActual
          return (
            <button
              key={mes.mes}
              type="button"
              aria-label={textoMes(mes)}
              onMouseEnter={() => setElegido(mes.mes)}
              onFocus={() => setElegido(mes.mes)}
              onBlur={() => setElegido(null)}
              className={`flex h-full items-end justify-center gap-[2px] rounded-t-md transition-colors ${CLASE_FOCO} ${
                visible.mes === mes.mes && !futuro ? 'bg-gray-100' : 'hover:bg-gray-50'
              } ${futuro ? 'pointer-events-none' : ''}`}
              tabIndex={futuro ? -1 : 0}
            >
              <Barra valor={mes.abiertos} maximo={maximo} clase={COLOR_ABIERTOS} />
              <Barra valor={mes.finalizados} maximo={maximo} clase={COLOR_FINALIZADOS} />
            </button>
          )
        })}
      </div>
      <div className="mt-1 grid grid-cols-12 gap-0.5" aria-hidden="true">
        {porMes.map((mes) => (
          <span
            key={mes.mes}
            className={`text-center text-[10.5px] ${
              mes.mes === visible.mes ? 'font-semibold text-gray-800' : mes.mes > mesActual ? 'text-gray-300' : 'text-gray-500'
            }`}
          >
            {nombreMesGT(mes.mes).slice(0, 3).toLowerCase()}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-gray-600 tabular-nums" aria-live="polite">
        {textoMes(visible)}
      </figcaption>
    </figure>
  )
}

function FormasFinalizacion({ inicio }: { inicio: InicioJuridicoDto }) {
  const { finalizados, finalizadosPorForma } = inicio.movimientoAnio
  if (finalizados === 0) return <Vacio>Todavía no se ha finalizado ningún proceso este año.</Vacio>
  const maximo = Math.max(1, ...FORMAS_FINALIZACION_PROCESO.map((forma) => finalizadosPorForma[forma]))
  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <h3 className="text-[13px] font-medium text-gray-800">Cómo se finalizaron</h3>
      <dl className="mt-2 space-y-1.5">
        {FORMAS_FINALIZACION_PROCESO.map((forma) => (
          <div key={forma} className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-3 text-[13px]">
            <dt className="text-gray-600">{ETIQUETAS_FORMA_FINALIZACION[forma]}</dt>
            <span className="block h-2 rounded-full bg-gray-100" aria-hidden="true">
              {finalizadosPorForma[forma] > 0 && (
                <span
                  className={`block h-2 rounded-full ${COLOR_FINALIZADOS}`}
                  style={{ width: `${(finalizadosPorForma[forma] / maximo) * 100}%` }}
                />
              )}
            </span>
            <dd className="text-right font-medium tabular-nums text-gray-900">{finalizadosPorForma[forma]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function PanoramaAnio({ inicio, mesActual }: { inicio: InicioJuridicoDto; mesActual: number }) {
  const { anio, movimientoAnio } = inicio
  return (
    <Seccion
      titulo={`Panorama ${anio}`}
      ayuda="Procesos abiertos y finalizados, mes a mes."
      enlace={{ texto: 'Ver reportes', destino: RUTAS_JURIDICO.reportes() }}
    >
      <div className="flex gap-4 border-t border-gray-100 px-4 pb-3 pt-3 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <Muestra clase={COLOR_ABIERTOS} />
          Abiertos <span className="font-medium tabular-nums text-gray-900">{movimientoAnio.abiertos}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Muestra clase={COLOR_FINALIZADOS} />
          Finalizados <span className="font-medium tabular-nums text-gray-900">{movimientoAnio.finalizados}</span>
        </span>
      </div>
      <GraficoPorMes inicio={inicio} mesActual={mesActual} />
      <FormasFinalizacion inicio={inicio} />
    </Seccion>
  )
}

/** En trámite hoy por categoría; todas las categorías, aunque estén en 0, para que no bailen. */
export function CargaPorCategoria({ inicio }: { inicio: InicioJuridicoDto }) {
  const { cargaActual, enTramitePorTipo } = inicio
  const totales = new Map<string, number>()
  for (const { tipo, total } of enTramitePorTipo) {
    const clave = CATEGORIA_POR_TIPO_PROCESO[tipo]
    totales.set(clave, (totales.get(clave) ?? 0) + total)
  }
  const filas = CATEGORIAS_PROCESO_JURIDICO.map((clave) => ({
    clave,
    etiqueta: ETIQUETAS_CATEGORIA_PROCESO[clave],
    total: totales.get(clave) ?? 0,
  })).sort((a, b) => b.total - a.total)
  const maximo = Math.max(1, ...filas.map((fila) => fila.total))
  const detenidos = [
    cargaActual.suspendidos > 0 && plural(cargaActual.suspendidos, 'suspendido', 'suspendidos'),
    cargaActual.abandonados > 0 && plural(cargaActual.abandonados, 'abandonado', 'abandonados'),
  ].filter(Boolean)

  return (
    <Seccion
      titulo="Carga por categoría"
      ayuda="Procesos en trámite hoy, por tipo de juicio."
      enlace={{ texto: 'Ver procesos', destino: RUTAS_JURIDICO.procesos() }}
    >
      <dl className="flex-1 space-y-3 border-t border-gray-100 px-4 py-3.5">
        {filas.map((fila) => (
          <div key={fila.clave}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <dt className={fila.total === 0 ? 'text-gray-400' : 'text-gray-700'}>{fila.etiqueta}</dt>
              <dd className={`font-medium tabular-nums ${fila.total === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                {fila.total}
              </dd>
            </div>
            <span className="mt-1 block h-1.5 rounded-full bg-gray-100" aria-hidden="true">
              {fila.total > 0 && (
                <span className="block h-1.5 rounded-full bg-brand-500" style={{ width: `${(fila.total / maximo) * 100}%` }} />
              )}
            </span>
          </div>
        ))}
      </dl>
      {detenidos.length > 0 && (
        <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Además, sin finalizar: {detenidos.join(' y ')}.
        </p>
      )}
    </Seccion>
  )
}
