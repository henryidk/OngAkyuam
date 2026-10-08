import { ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA, type EstadoAtencionPsicologica } from '@akyuam/shared'

const CLASES: Record<EstadoAtencionPsicologica, string> = {
  INICIO: 'bg-gray-100 text-gray-800',
  SEGUIMIENTO: 'bg-brand-50 text-brand-700',
  CIERRE: 'bg-green-100 text-green-800',
}

const ETIQUETAS: Record<EstadoAtencionPsicologica, string> = {
  ...ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA,
  CIERRE: 'Cerrado',
}

/** Insignia con la etapa de un proceso psicológico. */
export default function EtiquetaEtapa({ etapa }: { etapa: EstadoAtencionPsicologica }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASES[etapa]}`}>
      {ETIQUETAS[etapa]}
    </span>
  )
}
