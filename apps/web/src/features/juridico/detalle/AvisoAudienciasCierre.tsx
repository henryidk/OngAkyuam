import { AlertTriangle } from 'lucide-react'
import { ETIQUETAS_ORIGEN_CANCELACION, formatFechaGT, type AudienciaProgramadaDto } from '@akyuam/shared'

interface AvisoAudienciasCierreProps {
  audiencias: AudienciaProgramadaDto[]
  origen: 'PROCESO_FINALIZADO' | 'PROCESO_ABANDONADO'
  confirmado: boolean
  onConfirmado: (confirmado: boolean) => void
}

/** Cerrar el proceso cancela sus audiencias programadas: se listan y se confirma a propósito. */
export default function AvisoAudienciasCierre({ audiencias, origen, confirmado, onConfirmado }: AvisoAudienciasCierreProps) {
  const una = audiencias.length === 1
  return (
    <div role="note" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-gray-800">
      <p className="flex items-center gap-1.5 font-semibold text-[#8a5a14]">
        <AlertTriangle size={15} aria-hidden="true" />
        {una ? 'Este proceso tiene 1 audiencia programada' : `Este proceso tiene ${audiencias.length} audiencias programadas`}
      </p>
      <ul className="space-y-0.5 pl-5 text-[13px] tabular-nums">
        {audiencias.map((audiencia) => (
          <li key={audiencia.id} className="list-disc">
            {formatFechaGT(audiencia.fecha)} {audiencia.hora} · {audiencia.responsable.nombre}
          </li>
        ))}
      </ul>
      <p className="text-[13px]">
        {una ? 'Se cancelará' : 'Se cancelarán'} y {una ? 'quedará registrada' : 'quedarán registradas'} como «
        {ETIQUETAS_ORIGEN_CANCELACION[origen]}».
      </p>
      <label className="flex items-start gap-2 text-[13px] font-medium text-gray-900">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(evento) => onConfirmado(evento.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        {una ? 'Entiendo que la audiencia se cancelará' : 'Entiendo que las audiencias se cancelarán'}
      </label>
    </div>
  )
}
