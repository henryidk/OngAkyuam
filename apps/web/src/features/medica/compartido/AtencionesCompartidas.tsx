import type { ReactNode } from 'react'
import { ETIQUETAS_ESTADO_ATENCION_MEDICA, type EstadoAtencionMedica } from '@akyuam/shared'
import CodigoAtencion from './CodigoAtencion'
import { fechaDeInstante } from './fechas'

interface ConstanciaCompartida {
  id: string
  nombreVisible: string
  fecha: string
  mimeType: string
}

interface AtencionCompartida {
  codigo: string
  estado: EstadoAtencionMedica
  fechasConsulta: string[]
  constancias?: ConstanciaCompartida[]
}

interface AtencionesCompartidasProps {
  atenciones: AtencionCompartida[]
  /** Acciones de cada constancia (Ver / Descargar); cada área firma la URL con su propio endpoint. */
  accionesConstancia?: (constancia: ConstanciaCompartida) => ReactNode
}

/**
 * Lo que Medicina compartió con otra área (Jurídico o Psicología), de solo lectura. Si la médica
 * no compartió ninguna atención, la tarjeta no aparece: el área no necesita saber que existe.
 */
export default function AtencionesCompartidas({ atenciones, accionesConstancia }: AtencionesCompartidasProps) {
  if (atenciones.length === 0) return null
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Atención médica</h3>
        <span className="text-xs text-gray-500">Compartido por Medicina · solo lectura</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {atenciones.map((atencion) => (
          <li key={atencion.codigo} className="space-y-2 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <CodigoAtencion codigo={atencion.codigo} className="text-gray-700" />
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {ETIQUETAS_ESTADO_ATENCION_MEDICA[atencion.estado]}
              </span>
            </div>
            <p className="text-sm text-gray-700 tabular-nums">
              {atencion.fechasConsulta.length === 0
                ? 'Sin consultas registradas todavía.'
                : `Consultas: ${atencion.fechasConsulta.map(fechaDeInstante).join(', ')}`}
            </p>
            {atencion.constancias && atencion.constancias.length > 0 && (
              <ul aria-label={`Constancias de ${atencion.codigo}`} className="space-y-1">
                {atencion.constancias.map((constancia) => (
                  <li key={constancia.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                    <span className="min-w-0 text-sm text-gray-800">
                      {constancia.nombreVisible}
                      <span className="ml-2 text-xs text-gray-500 tabular-nums">{fechaDeInstante(constancia.fecha)}</span>
                    </span>
                    {accionesConstancia?.(constancia)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
