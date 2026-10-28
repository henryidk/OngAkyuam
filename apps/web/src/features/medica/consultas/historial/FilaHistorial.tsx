import { Paperclip } from 'lucide-react'
import type { ConsultaHistorialMedicaDto } from '@akyuam/shared'
import CodigoAtencion from '../../compartido/CodigoAtencion'
import { anioDe, fechaCorta } from '../../compartido/fechas'
import { primerNombre } from '../../compartido/personas'

/** Una consulta del historial: solo metadatos. El contenido clínico se ve al abrirla. */
export default function FilaHistorial({ consulta, onAbrir }: { consulta: ConsultaHistorialMedicaDto; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="grid w-full grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-[#eef0f2] px-[18px] py-3.5 text-left last:border-b-0 hover:bg-[#f8fafb]"
    >
      <span className="flex flex-col gap-px">
        <span className="whitespace-nowrap text-base font-semibold text-[#1c2430]">{fechaCorta(consulta.fecha)}</span>
        <span className="whitespace-nowrap text-xs tabular-nums text-[#5b6573]">
          {anioDe(consulta.fecha)} · {consulta.hora}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[14.5px] font-semibold text-[#1c2430]">{consulta.usuariaNombreCompleto}</span>
        {consulta.persona.ninoId && (
          <span className="text-[12.5px] text-[#7346a5]">
            Consulta de {primerNombre(consulta.persona.nombreCompleto)} · {consulta.persona.edad} años
          </span>
        )}
        <span className="flex flex-wrap items-center gap-2">
          <CodigoAtencion codigo={consulta.codigoAtencion} />
          {!consulta.conCita && <span className="text-[12px] text-[#5b6573]">Sin cita</span>}
          {consulta.totalDocumentos > 0 && (
            <span className="inline-flex items-center gap-1 text-[12px] text-[#5b6573]">
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
              {consulta.totalDocumentos} {consulta.totalDocumentos === 1 ? 'documento' : 'documentos'}
            </span>
          )}
        </span>
      </span>
      <span className="whitespace-nowrap text-[13px] font-medium text-[#7346a5]">Ver consulta</span>
    </button>
  )
}
