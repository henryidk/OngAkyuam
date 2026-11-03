import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellRing, X } from 'lucide-react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_NIVEL_AVISO_AUDIENCIA,
  formatFechaCortaGT,
  nivelMasUrgente,
  resumenAvisosAudiencias,
  type AvisoAudienciaDto,
  type NivelAvisoAudiencia,
} from '@akyuam/shared'
import { formatHora12 } from '../compartido/hora12'
import { RUTAS_JURIDICO } from '../rutas'
import { useAvisosAudiencias, type PermisoEscritorio } from './useAvisosAudiencias'

const CLASE_FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'

/** Del rojo al azul: lo de hoy salta a la vista, lo de la semana queda de fondo. */
const ESTILO_NIVEL: Record<NivelAvisoAudiencia, { insignia: string; etiqueta: string; borde: string }> = {
  HOY: { insignia: 'bg-red-600 text-white', etiqueta: 'bg-red-100 text-red-800', borde: 'border-l-red-500' },
  MANANA: { insignia: 'bg-orange-500 text-white', etiqueta: 'bg-orange-100 text-orange-800', borde: 'border-l-orange-400' },
  PASADO_MANANA: { insignia: 'bg-amber-400 text-amber-950', etiqueta: 'bg-amber-100 text-amber-800', borde: 'border-l-amber-300' },
  PROXIMOS_DIAS: { insignia: 'bg-sky-600 text-white', etiqueta: 'bg-sky-50 text-sky-800', borde: 'border-l-sky-300' },
}

/** "Hoy", "Mañana", "Pasado mañana"; más adelante, la fecha corta ("Vie 6 nov"). */
function etiquetaDia(aviso: AvisoAudienciaDto): string {
  return aviso.nivel === 'PROXIMOS_DIAS'
    ? formatFechaCortaGT(aviso.audiencia.fecha)
    : ETIQUETAS_NIVEL_AVISO_AUDIENCIA[aviso.nivel]
}

function FilaAviso({ aviso, alElegir }: { aviso: AvisoAudienciaDto; alElegir: () => void }) {
  const { audiencia, nivel } = aviso
  const categoria = ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[audiencia.tipoProceso]]
  return (
    <li>
      <Link
        to={RUTAS_JURIDICO.audienciasProceso(audiencia.procesoId, { audienciaId: audiencia.id })}
        onClick={alElegir}
        className={`block border-l-4 px-4 py-2.5 transition-colors hover:bg-gray-50 ${ESTILO_NIVEL[nivel].borde} ${CLASE_FOCO} focus-visible:ring-inset`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-gray-900">{audiencia.usuaria.nombreCompleto}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ESTILO_NIVEL[nivel].etiqueta}`}>
              {etiquetaDia(aviso)}
            </span>
            <span className="text-xs font-semibold tabular-nums text-gray-700">{formatHora12(audiencia.hora)}</span>
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-500">
          {audiencia.descripcion ?? categoria} · {audiencia.responsable.nombre}
        </span>
      </Link>
    </li>
  )
}

function AvisoPermiso({ permiso, alPedir }: { permiso: PermisoEscritorio; alPedir: () => void }) {
  if (permiso === 'default') {
    return (
      <button
        type="button"
        onClick={alPedir}
        className={`text-xs font-medium text-brand-700 hover:underline ${CLASE_FOCO}`}
      >
        Activar notificaciones
      </button>
    )
  }
  if (permiso === 'denied') {
    return <span className="text-right text-xs text-gray-500" title="Ícono del candado junto a la dirección → Notificaciones → Permitir">
        Notificaciones bloqueadas: actívalas en el candado de la barra de direcciones
      </span>
  }
  return null
}

export default function CampanaAudiencias() {
  const { datos, abierto, abrir, cerrar, permiso, pedirPermisoEscritorio } = useAvisosAudiencias()
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Se cierra con Escape o con un clic fuera, como cualquier menú desplegable.
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar()
    }
    const alPulsar = (evento: PointerEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) cerrar()
    }
    window.addEventListener('keydown', alTeclear)
    window.addEventListener('pointerdown', alPulsar)
    return () => {
      window.removeEventListener('keydown', alTeclear)
      window.removeEventListener('pointerdown', alPulsar)
    }
  }, [abierto, cerrar])

  const total = datos?.total ?? 0
  const urgente = datos ? nivelMasUrgente(datos.conteos) : null
  const Icono = urgente === 'HOY' || urgente === 'MANANA' ? BellRing : Bell
  const avisos = datos?.avisos ?? []
  const faltantes = datos ? datos.total - datos.avisos.length : 0

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={abierto ? cerrar : abrir}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={total > 0 ? `Audiencias próximas: ${total}` : 'Audiencias próximas: ninguna'}
        className={`relative rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 ${CLASE_FOCO}`}
      >
        <Icono size={20} strokeWidth={2} className={urgente === 'HOY' ? 'text-red-600' : undefined} />
        {total > 0 && urgente && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${ESTILO_NIVEL[urgente].insignia}`}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Próximas audiencias"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Próximas audiencias</p>
              <p className="text-xs text-gray-500">
                {total > 0 ? resumenAvisosAudiencias(datos!.conteos) : 'Ninguna en los próximos 7 días'}
              </p>
            </div>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className={`rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${CLASE_FOCO}`}
            >
              <X size={16} />
            </button>
          </div>

          {avisos.length > 0 && (
            // Una sola lista, de la más cercana a la más lejana: la urgencia la dicen el color y la etiqueta del día.
            <div className="max-h-[60vh] overflow-y-auto">
              <ul className="divide-y divide-gray-100">
                {avisos.map((aviso) => (
                  <FilaAviso key={aviso.audiencia.id} aviso={aviso} alElegir={cerrar} />
                ))}
              </ul>
              {faltantes > 0 && (
                <p className="px-4 py-2 text-xs text-gray-500">Y {faltantes} más en la sección Audiencias.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-2.5">
            <Link
              to={RUTAS_JURIDICO.audiencias()}
              onClick={cerrar}
              className={`text-xs font-medium text-brand-700 hover:underline ${CLASE_FOCO}`}
            >
              Ver todas
            </Link>
            <AvisoPermiso permiso={permiso} alPedir={() => void pedirPermisoEscritorio()} />
          </div>
        </div>
      )}
    </div>
  )
}
