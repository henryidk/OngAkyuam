import type { ReactNode } from 'react'

interface TarjetaColaProps {
  nombre: string
  numero: string
  detalle?: string
  insignia?: ReactNode
  /** Acciones de la tarjeta — apiladas, la principal primero. */
  children: ReactNode
}

/**
 * Tarjeta de una fila en las colas laterales de la agenda (referencias sin tomar, pendientes de
 * agendar). Presentación pura: no sabe qué cola la usa ni qué hacen sus acciones, solo las
 * coloca — así ambas colas se ven iguales sin duplicar el marcado (§8.3 del plan).
 */
export default function TarjetaCola({ nombre, numero, detalle, insignia, children }: TarjetaColaProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-800">{nombre}</p>
          <p className="text-xs text-gray-500">{numero}</p>
        </div>
        {insignia}
      </div>
      {detalle && <p className="mt-2 text-xs text-gray-500">{detalle}</p>}
      <div className="mt-3 flex flex-col items-start gap-2">{children}</div>
    </div>
  )
}
