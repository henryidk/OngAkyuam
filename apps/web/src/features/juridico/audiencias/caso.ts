import type { AccionAudiencia, AudienciaFilaDto } from '@akyuam/shared'

/**
 * El proceso al que se le agenda una audiencia, con lo justo para el encabezado del modal y los
 * valores iniciales. Se arma desde una fila de Audiencias o desde un proceso (Procesos, detalle).
 */
export interface CasoAudiencia {
  procesoId: string
  codigoProceso: string
  usuariaNombre: string
  numeroJudicial: string | null
  /** Responsable que se preselecciona: la abogada del proceso o la de la audiencia anterior. */
  responsableId: string | null
}

export function casoDesdeAudiencia(audiencia: AudienciaFilaDto): CasoAudiencia {
  return {
    procesoId: audiencia.procesoId,
    codigoProceso: audiencia.codigoProceso,
    usuariaNombre: audiencia.usuaria.nombreCompleto,
    numeroJudicial: audiencia.numeroJudicial,
    responsableId: audiencia.responsable.id,
  }
}

/** Qué modal de audiencia está abierto: agendar desde un proceso, o una acción sobre una audiencia. */
export type ModalAudiencia =
  | { tipo: 'AGENDAR'; caso: CasoAudiencia }
  | { tipo: AccionAudiencia; audiencia: AudienciaFilaDto }

/** Props comunes de los modales de acción sobre una audiencia. */
export interface PropsModalAudiencia {
  audiencia: AudienciaFilaDto
  onCerrar: () => void
  /** Se guardó: avisar y refrescar. `siguiente` abre otro modal enseguida ("Agendar nueva fecha ahora"). */
  onHecho: (mensaje: string, siguiente?: ModalAudiencia) => void
  /** 409: otra persona la cambió o la acción ya no aplica; se refresca la lista. */
  onConflicto: () => void
}
