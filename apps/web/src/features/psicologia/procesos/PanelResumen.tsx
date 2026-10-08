import type { ReactNode } from 'react'
import type { ProcesoPsicologiaDetalle } from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'
import { etiquetaPersona } from '../compartido/personas'

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[13px] text-gray-500">{etiqueta}</dt>
      <dd className="text-right text-[13px] font-medium text-gray-900 tabular-nums">{children}</dd>
    </div>
  )
}

interface PanelResumenProps {
  proceso: ProcesoPsicologiaDetalle
  /** null mientras no se hayan cargado todas las sesiones: no se muestra un conteo a medias. */
  inasistencias: number | null
}

export default function PanelResumen({ proceso, inasistencias }: PanelResumenProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <h3 className="mb-1.5 text-sm font-semibold text-gray-900">Resumen del proceso</h3>
      <dl className="divide-y divide-gray-100">
        <Dato etiqueta="Sesiones">{proceso.sesionesAtendidas}</Dato>
        {inasistencias !== null && <Dato etiqueta="Inasistencias">{inasistencias}</Dato>}
        <Dato etiqueta="Inicio">{fechaDeInstante(proceso.fechaInicio)}</Dato>
        <Dato etiqueta="Última sesión">
          {proceso.ultimaSesion ? fechaDeInstante(proceso.ultimaSesion.fechaHora) : '—'}
        </Dato>
      </dl>
      {proceso.personasAtendidas.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] text-gray-500">Personas atendidas</p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-gray-900">
            {proceso.personasAtendidas.map((persona) => (
              <li key={persona.ninoId ?? 'usuaria'}>{etiquetaPersona(persona)}</li>
            ))}
          </ul>
        </div>
      )}
      {proceso.motivoReferencia && (
        <div className="mt-3">
          <p className="text-[13px] text-gray-500">Motivo de referencia</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-900">{proceso.motivoReferencia}</p>
        </div>
      )}
    </section>
  )
}
