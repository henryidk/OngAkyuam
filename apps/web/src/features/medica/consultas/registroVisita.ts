import type { CampoSignoFormulario, PersonaConsultaMedicaDto } from '@akyuam/shared'
import { leerSignos, signosVacios, type ValoresSignos } from './signosFormulario'

/** Lo escrito para una persona de la visita. Vive solo en memoria: nunca en localStorage. */
export interface EstadoPersona {
  signos: ValoresSignos
  motivo: string
  diagnostico: string
  plan: string
  receta: string
}

/** Resumen de los documentos de una persona, que su panel reporta al formulario. */
export interface ResumenDocumentos {
  lote: string
  cantidad: number
  hayListos: boolean
  subiendo: boolean
  conError: boolean
}

export const SIN_DOCUMENTOS: Omit<ResumenDocumentos, 'lote'> = {
  cantidad: 0,
  hayListos: false,
  subiendo: false,
  conError: false,
}

/** Punto de partida: vacío, con la última talla de la persona precargada. */
export function estadoInicial(persona: PersonaConsultaMedicaDto): EstadoPersona {
  return { signos: signosVacios(persona.ultimaTallaM), motivo: '', diagnostico: '', plan: '', receta: '' }
}

export function tieneCambios(estado: EstadoPersona, inicial: EstadoPersona, documentos: number): boolean {
  return (
    documentos > 0 ||
    [estado.motivo, estado.diagnostico, estado.plan, estado.receta].some((texto) => texto.trim() !== '') ||
    (Object.keys(estado.signos) as CampoSignoFormulario[]).some((clave) => estado.signos[clave] !== inicial.signos[clave])
  )
}

/** Qué le falta a una persona para poder guardar la visita, o null si está lista. */
export function pendienteDe(estado: EstadoPersona, documentos: Omit<ResumenDocumentos, 'lote'>): string | null {
  if (estado.diagnostico.trim() === '') return 'falta el diagnóstico'
  if (Object.keys(leerSignos(estado.signos).errores).length > 0) return 'revisa los signos vitales marcados en rojo'
  if (documentos.subiendo) return 'aún se están subiendo documentos'
  if (documentos.conError) return 'hay un documento que no se subió (reintenta o quítalo)'
  return null
}
