import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CircleCheck, ClipboardList, Scale, type LucideIcon } from 'lucide-react'
import { formatFechaLargaGT, horaActualGT, hoyGT, type InicioJuridicoDto } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { useAuthStore } from '../../../store/auth.store'
import { obtenerInicio } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { formatHora12 } from '../compartido/hora12'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import { ProximasAudiencias } from './AudienciasInicio'
import { CargaPorCategoria, PanoramaAnio } from './PanoramaInicio'
import { CLASE_AMBAR, CLASE_FOCO, plural } from './piezas'

function saludo(): string {
  const hora = horaActualGT()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

type Tono = 'ambar' | 'marca' | 'calma'

interface CifraProps {
  icono: LucideIcon
  etiqueta: string
  valor: number
  detalle: string
  destino: string
  /** Ámbar: trabajo atrasado. Marca: dato del día. Calma: nada pendiente detrás del número. */
  tono: Tono
}

const TONO_ICONO: Record<Tono, string> = {
  ambar: 'bg-[#f6ecdc] text-[#8a5a14]',
  marca: 'bg-brand-50 text-brand-700',
  calma: 'bg-gray-100 text-gray-500',
}

const TONO_VALOR: Record<Tono, string> = {
  ambar: CLASE_AMBAR,
  marca: 'text-brand-700',
  calma: 'text-gray-900',
}

function Cifra({ icono: Icono, etiqueta, valor, detalle, destino, tono }: CifraProps) {
  return (
    <Link
      to={destino}
      className={`group flex flex-col bg-white px-4 py-3 transition-colors hover:bg-gray-50 ${CLASE_FOCO} focus-visible:ring-inset`}
    >
      <span className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
        <span className={`grid size-6 shrink-0 place-items-center rounded-md ${TONO_ICONO[tono]}`}>
          <Icono size={14} strokeWidth={2} aria-hidden="true" />
        </span>
        {etiqueta}
      </span>
      <span className={`mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums ${TONO_VALOR[tono]}`}>
        {valor}
      </span>
      <span className="mt-1.5 truncate text-xs text-gray-500 group-hover:text-gray-700">{detalle}</span>
    </Link>
  )
}

function Cifras({ inicio, hoy }: { inicio: InicioJuridicoDto; hoy: string }) {
  const { anio, audiencias, cargaActual, movimientoAnio } = inicio
  const siguiente = audiencias.agenda.items[0]
  const siguienteHoy = siguiente && siguiente.fecha === hoy ? siguiente : null
  const delAnio = cargaActual.enTramite - cargaActual.enTramiteDeSeguimiento

  return (
    <section aria-labelledby="titulo-cifras">
      <h2 id="titulo-cifras" className="sr-only">
        Cifras del área
      </h2>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 shadow-[0_1px_2px_rgba(16,24,40,.04)] lg:grid-cols-4">
        <Cifra
          icono={CalendarDays}
          etiqueta="Audiencias hoy"
          valor={audiencias.restantesHoy}
          detalle={siguienteHoy ? `La siguiente, a las ${formatHora12(siguienteHoy.hora)}` : 'No quedan audiencias hoy'}
          destino={RUTAS_JURIDICO.audiencias()}
          tono={audiencias.restantesHoy > 0 ? 'marca' : 'calma'}
        />
        <Cifra
          icono={ClipboardList}
          etiqueta="Resultados por registrar"
          valor={audiencias.pendientesResultado}
          detalle={
            audiencias.pendientesResultado > 0
              ? 'Audiencias que ya pasaron sin resultado'
              : 'Todas las audiencias tienen resultado'
          }
          destino={RUTAS_JURIDICO.audiencias({ vista: 'pendientes' })}
          tono={audiencias.pendientesResultado > 0 ? 'ambar' : 'calma'}
        />
        <Cifra
          icono={Scale}
          etiqueta="En trámite"
          valor={cargaActual.enTramite}
          detalle={`${delAnio} de ${anio} · ${cargaActual.enTramiteDeSeguimiento} de seguimiento`}
          destino={RUTAS_JURIDICO.procesos()}
          tono="calma"
        />
        <Cifra
          icono={CircleCheck}
          etiqueta={`Finalizados en ${anio}`}
          valor={movimientoAnio.finalizados}
          detalle={`De ${plural(movimientoAnio.abiertos, 'proceso abierto', 'procesos abiertos')} este año`}
          destino={RUTAS_JURIDICO.reportes()}
          tono="calma"
        />
      </div>
    </section>
  )
}

/**
 * Pantalla de entrada de Jurídico: una vista rápida que cabe en la pantalla, sin scroll. Arriba,
 * las cifras; abajo, la agenda corta, cómo va el año y dónde está la carga. Las listas de trabajo
 * viven en sus secciones (Audiencias, Área de atención, Procesos).
 */
export default function InicioJuridico() {
  useTituloPagina({ titulo: 'Inicio' })
  const nombre = useAuthStore((estado) => estado.usuario?.nombreCompleto.split(/\s+/)[0] ?? '')
  const { versionNovedades } = useContextoJuridico()

  const cargar = useCallback(() => obtenerInicio(), [])
  const { datos: inicio, error, recargar } = useRecurso(cargar)

  // Un aviso del socket vuelve a pedir el Inicio sin desmontar lo que ya se ve.
  const versionVista = useRef(versionNovedades)
  useEffect(() => {
    if (versionVista.current === versionNovedades) return
    versionVista.current = versionNovedades
    void recargar()
  }, [versionNovedades, recargar])

  const hoy = hoyGT()
  const mesActual = Number(hoy.slice(5, 7))

  return (
    <div className="mx-auto max-w-[1320px] space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-xl font-semibold tracking-tight text-gray-900">
          {saludo()}
          {nombre && `, ${nombre}`}
        </p>
        <p className="text-sm text-gray-500 first-letter:uppercase">{formatFechaLargaGT(hoy)}</p>
      </div>

      {error && !inicio ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el inicio" onReintentar={() => void recargar()} />
      ) : !inicio ? (
        <Esqueleto />
      ) : (
        <>
          <Cifras inicio={inicio} hoy={hoy} />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <ProximasAudiencias audiencias={inicio.audiencias} hoy={hoy} />
            <PanoramaAnio inicio={inicio} mesActual={mesActual} />
            <CargaPorCategoria inicio={inicio} />
          </div>
        </>
      )}
    </div>
  )
}
