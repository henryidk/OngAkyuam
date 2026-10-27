import { Search } from 'lucide-react'
import {
  BUSQUEDA_CONSULTAS_PSICOLOGIA_MIN,
  BUSQUEDA_PSICOLOGIA_MAX,
  CLINICAS_PSICOLOGIA,
  ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA,
  ETIQUETAS_CLINICA_PSICOLOGIA,
  hoyGT,
  type ClinicaPsicologia,
  type EstadoHistorialConsultasPsicologia,
} from '@akyuam/shared'
import SelectorAlcance from '../../compartido/SelectorAlcance'
import { ETIQUETAS_ESTADO_HISTORIAL } from './etiquetas'
import type { FiltrosHistorialEstado } from './useHistorialConsultas'

const CLASE_CAMPO =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const CLASE_ETIQUETA = 'text-xs font-medium text-gray-600'

interface FiltrosHistorialProps {
  filtros: FiltrosHistorialEstado
  errorRango: string | null
  cambiar: <K extends keyof FiltrosHistorialEstado>(clave: K, valor: FiltrosHistorialEstado[K]) => void
}

/** Todos los filtros del Historial en una sola barra; en pantalla angosta bajan uno tras otro. */
export default function FiltrosHistorial({ filtros, errorRango, cambiar }: FiltrosHistorialProps) {
  const hoy = hoyGT()
  const recortado = filtros.texto.trim()
  const textoCorto = recortado.length > 0 && recortado.length < BUSQUEDA_CONSULTAS_PSICOLOGIA_MIN

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          <span className={CLASE_ETIQUETA}>Persona</span>
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={filtros.texto}
              maxLength={BUSQUEDA_PSICOLOGIA_MAX}
              autoComplete="off"
              placeholder="Nombre o expediente"
              onChange={(evento) => cambiar('texto', evento.target.value)}
              className={`${CLASE_CAMPO} w-full pl-9`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASE_ETIQUETA}>Desde</span>
          <input
            type="date"
            value={filtros.desde}
            max={hoy}
            onChange={(evento) => evento.target.value && cambiar('desde', evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASE_ETIQUETA}>Hasta</span>
          <input
            type="date"
            value={filtros.hasta}
            max={hoy}
            onChange={(evento) => evento.target.value && cambiar('hasta', evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASE_ETIQUETA}>Clínica</span>
          <select
            value={filtros.clinica ?? ''}
            onChange={(evento) => cambiar('clinica', (evento.target.value || null) as ClinicaPsicologia | null)}
            className={CLASE_CAMPO}
          >
            <option value="">Todas</option>
            {CLINICAS_PSICOLOGIA.map((clinica) => (
              <option key={clinica} value={clinica}>
                {ETIQUETAS_CLINICA_PSICOLOGIA[clinica]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASE_ETIQUETA}>Estado</span>
          <select
            value={filtros.estado ?? ''}
            onChange={(evento) =>
              cambiar('estado', (evento.target.value || null) as EstadoHistorialConsultasPsicologia | null)
            }
            className={CLASE_CAMPO}
          >
            <option value="">Todos</option>
            {ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO_HISTORIAL[estado]}
              </option>
            ))}
          </select>
        </label>
        <SelectorAlcance etiqueta="Atendidas por" valor={filtros.de} femenino onCambio={(de) => cambiar('de', de)} />
      </div>
      {textoCorto && <p className="text-xs text-gray-500">Escribe al menos {BUSQUEDA_CONSULTAS_PSICOLOGIA_MIN} letras.</p>}
      {errorRango && (
        <p role="alert" className="text-sm text-red-600">
          {errorRango}
        </p>
      )}
    </div>
  )
}
