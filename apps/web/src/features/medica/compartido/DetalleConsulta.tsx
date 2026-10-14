import { ETIQUETAS_TIPO_DOCUMENTO_MEDICO, type ConsultaMedicaDto, type DocumentoMedicoDto } from '@akyuam/shared'
import { etiquetaFormato } from '../../../lib/documentos/archivoDocumento'
import AccionesDocumento from './AccionesDocumento'
import { CLASE_SECCION } from './estilos'
import SignosVitales from './SignosVitales'
import { haySignos } from './textoSignos'

/** Insignia "PDF" / "IMG" del mockup. */
export function InsigniaFormato({ mimeType }: { mimeType: string }) {
  return (
    <span className="flex-none rounded-[3px] bg-[#fbe4e1] px-[5px] py-[3px] text-[10.5px] font-bold text-[#9b2c20]">
      {etiquetaFormato(mimeType)}
    </span>
  )
}

/** Documento adjunto a una consulta, compacto: insignia, nombre, tipo y "Ver". */
export function ChipDocumento({ documento }: { documento: DocumentoMedicoDto }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-[#e3e6ea] px-3 py-2">
      <InsigniaFormato mimeType={documento.mimeType} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-[#1c2430]">{documento.nombreVisible}</span>
        <span className="text-[11.5px] text-[#5b6573]">{ETIQUETAS_TIPO_DOCUMENTO_MEDICO[documento.tipo]}</span>
      </div>
      <AccionesDocumento documentoId={documento.id} nombre={documento.nombreVisible} conDescarga={false} />
    </div>
  )
}

/**
 * Cuerpo de una consulta registrada: signos vitales, los cuatro textos clínicos y los documentos.
 * Lo usan la historia clínica (desplegada) y "Consultas anteriores" del formulario.
 */
export default function DetalleConsulta({ consulta }: { consulta: ConsultaMedicaDto }) {
  const campos = [
    { etiqueta: 'Motivo de consulta', valor: consulta.motivoConsulta },
    { etiqueta: 'Diagnóstico', valor: consulta.diagnostico },
    { etiqueta: 'Plan de tratamiento', valor: consulta.planTratamiento },
    { etiqueta: 'Receta y laboratorios', valor: consulta.recetaLaboratorios },
  ]
  return (
    <div className="flex flex-col gap-3.5">
      {haySignos(consulta.signos) && (
        <div className="flex flex-col gap-2">
          <h4 className={CLASE_SECCION}>Signos vitales</h4>
          <SignosVitales signos={consulta.signos} />
        </div>
      )}
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-6 gap-y-3.5 text-[13.5px] leading-normal">
        {campos.map((campo) => (
          <div key={campo.etiqueta} className="flex flex-col gap-[3px]">
            <dt className={CLASE_SECCION}>{campo.etiqueta}</dt>
            <dd className="whitespace-pre-line text-pretty text-[#1c2430]">{campo.valor || '—'}</dd>
          </div>
        ))}
      </dl>
      {consulta.documentos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {consulta.documentos.map((documento) => (
            <ChipDocumento key={documento.id} documento={documento} />
          ))}
        </div>
      )}
    </div>
  )
}
