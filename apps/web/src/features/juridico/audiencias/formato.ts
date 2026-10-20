import {
  formatFechaGT,
  formatFechaLargaGT,
  sumarDiasGT,
  type AccionAudiencia,
  type AudienciaEnlazadaDto,
  type AudienciaFilaDto,
  type AudienciaOcupadaDto,
} from '@akyuam/shared'

// Reglas de presentación de la sección Audiencias. Funciones puras: `hoy` llega como argumento
// ("YYYY-MM-DD" de Guatemala) para que las pruebas no dependan del reloj.

/** "Hoy", "Mañana" o "Lunes 20 de octubre". */
export function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDiasGT(hoy, 1)) return 'Mañana'
  return formatFechaLargaGT(fecha)
}

export interface GrupoDia<T> {
  fecha: string
  etiqueta: string
  esHoy: boolean
  items: T[]
}

/** Agrupa filas ya ordenadas por fecha, respetando ese orden (Próximas viene ascendente). */
export function agruparPorDia<T extends { fecha: string }>(items: T[], hoy: string): GrupoDia<T>[] {
  const grupos: GrupoDia<T>[] = []
  for (const item of items) {
    const ultimo = grupos.at(-1)
    if (ultimo?.fecha === item.fecha) {
      ultimo.items.push(item)
    } else {
      grupos.push({ fecha: item.fecha, etiqueta: etiquetaDia(item.fecha, hoy), esHoy: item.fecha === hoy, items: [item] })
    }
  }
  return grupos
}

/** Cuánto lleva esperando el resultado: "Hoy", "Ayer", "Hace 3 días". */
export function textoEspera(diasTranscurridos: number): string {
  if (diasTranscurridos <= 0) return 'Hoy'
  if (diasTranscurridos === 1) return 'Ayer'
  return `Hace ${diasTranscurridos} días`
}

/** Confirmación en vivo del modal: "Martes 21 de octubre, 09:30 (hora de Guatemala)". */
export function textoFechaHora(fecha: string, hora: string): string {
  return `${formatFechaLargaGT(fecha)}, ${hora} (hora de Guatemala)`
}

/**
 * La audiencia que ya ocupa esa hora de la responsable, si hay. `excluirId` es la que se está
 * reprogramando: moverla a su misma hora con otra responsable no choca consigo misma.
 */
export function audienciaEnHora(
  ocupadas: AudienciaOcupadaDto[],
  hora: string,
  excluirId?: string,
): AudienciaOcupadaDto | undefined {
  return ocupadas.find((ocupada) => ocupada.hora === hora && ocupada.id !== excluirId)
}

/** La acción que se muestra como botón en la fila; el resto va al menú. Orden = prioridad. */
const ACCIONES_PRINCIPALES: AccionAudiencia[] = ['REGISTRAR_RESULTADO', 'AGENDAR_NUEVA_FECHA', 'REPROGRAMAR']

export function separarAcciones(acciones: AccionAudiencia[]): {
  principal: AccionAudiencia | null
  secundarias: AccionAudiencia[]
} {
  const principal = ACCIONES_PRINCIPALES.find((accion) => acciones.includes(accion)) ?? null
  return { principal, secundarias: acciones.filter((accion) => accion !== principal) }
}

export const ETIQUETAS_ACCION_AUDIENCIA: Record<AccionAudiencia, string> = {
  REPROGRAMAR: 'Reprogramar',
  CAMBIAR_RESPONSABLE: 'Cambiar responsable',
  CANCELAR: 'Cancelar audiencia',
  REGISTRAR_RESULTADO: 'Registrar resultado',
  EDITAR_OBSERVACIONES: 'Ver / completar observaciones',
  ADJUNTAR_DOCUMENTO: 'Adjuntar documento',
  AGENDAR_NUEVA_FECHA: 'Agendar nueva fecha',
}

/** Encabezado de los modales, para no equivocarse de caso. */
export function textoCaso(audiencia: Pick<AudienciaFilaDto, 'usuaria' | 'codigoProceso'>): string {
  return `${audiencia.usuaria.nombreCompleto} · ${audiencia.codigoProceso}`
}

/** "04/11/2026 09:00": la otra punta de una reprogramación. */
export function textoEnlazada(audiencia: AudienciaEnlazadaDto): string {
  return `${formatFechaGT(audiencia.fecha)} ${audiencia.hora}`
}
