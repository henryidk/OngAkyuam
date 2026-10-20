import { Search } from 'lucide-react'
import { BUSQUEDA_MAX, ESTADOS_AUDIENCIA, ETIQUETAS_ESTADO_AUDIENCIA, type EstadoAudiencia } from '@akyuam/shared'
import Switch from '../../../components/ui/Switch'
import { usePersonalJuridico } from '../compartido/usePersonalJuridico'
import type { FiltrosAudiencias as Filtros } from './filtros'

const CLASE_CONTROL =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

interface FiltrosAudienciasProps {
  filtros: Filtros
  texto: string
  onTexto: (texto: string) => void
  onCambiar: (cambios: Partial<Filtros>) => void
}

export default function FiltrosAudiencias({ filtros, texto, onTexto, onCambiar }: FiltrosAudienciasProps) {
  const { abogadas, cargando } = usePersonalJuridico()
  const historial = filtros.vista === 'historial'

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <label className="relative block w-full sm:w-[320px]">
        <span className="sr-only">Buscar por usuaria, No. interno o No. judicial</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={texto}
          maxLength={BUSQUEDA_MAX}
          onChange={(evento) => onTexto(evento.target.value)}
          placeholder="Buscar por usuaria, No. interno o No. judicial"
          autoComplete="off"
          className={`${CLASE_CONTROL} w-full pl-9`}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
        Responsable
        <select
          value={filtros.mias ? '' : filtros.responsableId}
          disabled={filtros.mias || cargando}
          onChange={(evento) => onCambiar({ responsableId: evento.target.value })}
          className={CLASE_CONTROL}
        >
          <option value="">Todas</option>
          {abogadas.map((abogada) => (
            <option key={abogada.id} value={abogada.id}>
              {abogada.nombre}
            </option>
          ))}
        </select>
      </label>

      {historial && (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Desde
            <input
              type="date"
              value={filtros.desde}
              max={filtros.hasta}
              onChange={(evento) => evento.target.value && onCambiar({ desde: evento.target.value })}
              className={CLASE_CONTROL}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Hasta
            <input
              type="date"
              value={filtros.hasta}
              min={filtros.desde}
              onChange={(evento) => evento.target.value && onCambiar({ hasta: evento.target.value })}
              className={CLASE_CONTROL}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Estado
            <select
              value={filtros.estado}
              onChange={(evento) => onCambiar({ estado: evento.target.value as EstadoAudiencia | '' })}
              className={CLASE_CONTROL}
            >
              <option value="">Todos</option>
              {ESTADOS_AUDIENCIA.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETAS_ESTADO_AUDIENCIA[estado]}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <div className="flex items-center gap-2 pb-2 text-[13px] text-gray-700">
        <Switch encendido={filtros.mias} onChange={(valor) => onCambiar({ mias: valor })} ariaLabel="Solo mis audiencias" />
        <span aria-hidden="true">Solo mis audiencias</span>
      </div>
    </div>
  )
}
