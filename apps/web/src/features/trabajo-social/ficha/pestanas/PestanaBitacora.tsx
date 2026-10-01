import { History } from 'lucide-react'
import { formatInstanteGT, type EventoBitacora } from '@akyuam/shared'
import EmptyState from '../../../../components/ui/EmptyState'
import { useContextoFicha } from '../contextoFicha'
import { useBitacora } from '../useBitacora'
import Tarjeta from './Tarjeta'

/** Pestaña Bitácora (plan §12.5): quién hizo qué en los casos de la usuaria. Solo lectura. */
export default function PestanaBitacora() {
  const { usuaria, version } = useContextoFicha()
  const { eventos, error } = useBitacora(usuaria.id, version)
  const variosCasos = usuaria.casos.length > 1

  return (
    <Tarjeta titulo="Bitácora del expediente">
      <p className="-mt-2 mb-5 text-[13px] text-gray-500">Registro automático de quién hizo qué. No se edita.</p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && !eventos && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((indice) => (
            <div key={indice} className="h-5 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}
      {eventos && eventos.length === 0 && (
        <EmptyState
          Icono={History}
          titulo="Todavía no hay movimientos"
          descripcion="Aquí aparecerá cada referido, documento subido y cambio de acceso de este expediente."
        />
      )}
      {eventos && eventos.length > 0 && (
        <ol>
          {eventos.map((evento, indice) => (
            <FilaEvento
              key={evento.id}
              evento={evento}
              ultimo={indice === eventos.length - 1}
              mostrarCaso={variosCasos}
            />
          ))}
        </ol>
      )}
    </Tarjeta>
  )
}

interface FilaEventoProps {
  evento: EventoBitacora
  ultimo: boolean
  /** Con un solo caso el número sobra; con varios dice a cuál pertenece el evento. */
  mostrarCaso: boolean
}

function FilaEvento({ evento, ultimo, mostrarCaso }: FilaEventoProps) {
  return (
    <li className="grid grid-cols-[120px_14px_1fr] gap-3">
      <time dateTime={evento.fecha} className="text-right text-xs tabular-nums text-gray-500">
        {formatInstanteGT(evento.fecha)}
      </time>
      <span aria-hidden="true" className="flex flex-col items-center">
        <span
          className={`mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full ${evento.destacado ? 'bg-brand-600' : 'bg-gray-300'}`}
        />
        {!ultimo && <span className="w-px flex-1 bg-gray-200" />}
      </span>
      <p className="pb-[18px] text-sm text-gray-800">
        {evento.texto}
        {mostrarCaso && evento.numeroExpediente && (
          <span className="tabular-nums text-gray-500"> · caso {evento.numeroExpediente}</span>
        )}
        {evento.autor && <span className="text-gray-500"> · {evento.autor}</span>}
      </p>
    </li>
  )
}
