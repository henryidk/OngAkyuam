import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck } from 'lucide-react'

interface TarjetaPendienteProps {
  titulo: string
  /** El total de la lista a la que lleva, calculado por el servidor; null mientras carga. */
  total: number | null
  /** Una línea de contexto ("La que más espera: 6 días"); se omite con 0 pendientes. */
  contexto?: string
  /** Lo que se ve con 0 pendientes, junto al check gris: la tarjeta no desaparece. */
  textoVacio: string
  /** Texto del enlace ("Ver y agendar", "Revisar"). */
  accion: string
  /** Nombre completo del enlace para lectores de pantalla ("15 pacientes sin próxima consulta, revisar"). */
  etiqueta: string
  to: string
  /** Ámbar solo cuando alguien espera más de lo razonable; lo demás, neutro (plan §5.2.5). */
  urgente?: boolean
  /** Lista corta debajo del encabezado (p. ej. las primeras 5 por agendar). */
  children?: ReactNode
}

/**
 * Tarjeta informativa de lo pendiente arriba de la Agenda: número, una línea de contexto y un
 * enlace a la lista completa. Es la misma en Medicina y Psicología; solo cambian los destinos.
 */
export default function TarjetaPendiente({
  titulo,
  total,
  contexto,
  textoVacio,
  accion,
  etiqueta,
  to,
  urgente = false,
  children,
}: TarjetaPendienteProps) {
  const ambar = urgente && (total ?? 0) > 0
  return (
    <section
      className={`overflow-hidden rounded-lg border bg-white ${ambar ? 'border-estado-pendiente-borde' : 'border-borde'}`}
    >
      <Link
        to={to}
        aria-label={total === null ? titulo : etiqueta}
        className={`group flex items-start justify-between gap-3 px-4 py-3 ${
          ambar ? 'bg-estado-pendiente-fondo hover:bg-estado-pendiente-insignia' : 'hover:bg-superficie'
        }`}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
          {total === null ? (
            <span aria-hidden="true" className="mt-1 h-3 w-36 animate-pulse rounded bg-superficie-hundida" />
          ) : total === 0 ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-texto-suave">
              <CircleCheck aria-hidden="true" className="h-4 w-4 text-texto-sutil" />
              {textoVacio}
            </span>
          ) : (
            <>
              {contexto && <span className={`text-[12.5px] ${ambar ? 'text-estado-pendiente' : 'text-texto-suave'}`}>{contexto}</span>}
              <span className="mt-1 flex items-center gap-1 text-[12.5px] font-medium text-brand-600 group-hover:underline group-hover:underline-offset-2">
                {accion}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            </>
          )}
        </div>
        {total === null ? (
          <span aria-hidden="true" className="h-6 w-8 animate-pulse rounded bg-superficie-hundida" />
        ) : (
          <span className={`text-[22px] font-semibold leading-none tabular-nums ${ambar ? 'text-estado-pendiente' : 'text-texto'}`}>
            {total}
          </span>
        )}
      </Link>
      {children}
    </section>
  )
}
