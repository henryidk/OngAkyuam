import type { FieldPath } from 'react-hook-form'
import type { RegistroUsuariaNuevaFormValues } from '@akyuam/shared'

export type PasoId = 'caso' | 'usuaria' | 'agresor' | 'registro' | 'areas' | 'documentos' | 'revision'

export interface PasoWizard {
  id: PasoId
  titulo: string
  descripcion: string
  /** Rutas del formulario a validar antes de avanzar a este paso. Vacío = sin datos propios que validar. */
  campos: FieldPath<RegistroUsuariaNuevaFormValues>[]
}

export interface EstadoPaso {
  paso: PasoWizard
  indice: number
  completado: boolean
  activo: boolean
  alcanzable: boolean
}

export function calcularEstadoPasos(pasos: PasoWizard[], pasoActualId: PasoId): EstadoPaso[] {
  const indiceActual = pasos.findIndex((paso) => paso.id === pasoActualId)
  return pasos.map((paso, indice) => ({
    paso,
    indice,
    completado: indice < indiceActual,
    activo: indice === indiceActual,
    alcanzable: indice <= indiceActual,
  }))
}

const PASOS_BASE: PasoWizard[] = [
  {
    id: 'caso',
    titulo: 'Datos del caso',
    descripcion: 'Fecha y tipología del delito.',
    campos: ['datosCaso.fecha', 'datosCaso.tipologiaDelito'],
  },
  {
    id: 'usuaria',
    titulo: 'Datos de la usuaria',
    descripcion: 'Identificación, ubicación y datos para estadística de población beneficiada.',
    campos: ['datosUsuaria'],
  },
  {
    id: 'agresor',
    titulo: 'Datos del agresor',
    descripcion: 'Solo si la usuaria los proporcionó.',
    campos: ['datosCaso.datosAgresor'],
  },
  {
    id: 'registro',
    titulo: 'Tipo de registro',
    descripcion: 'Interna (solicita albergue) o externa, y niñas o niños si aplica.',
    campos: ['datosCaso.tipoRegistro', 'datosCaso.ninos'],
  },
  {
    id: 'areas',
    titulo: 'Áreas de atención',
    descripcion: 'Refiere el caso a las áreas que deban tener acceso a esta información.',
    campos: ['datosCaso.areasReferidas'],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    descripcion: 'Entrevista a usuaria y, si aplica, documentos de ingreso a albergue.',
    campos: [],
  },
  {
    id: 'revision',
    titulo: 'Revisión',
    descripcion: 'Confirma los datos antes de registrar.',
    campos: [],
  },
]

/**
 * Único lugar que decide qué pasos existen según el modo (OCP): cuando la usuaria ya existe se
 * omite el paso de identidad (ya se capturó antes) sin que el componente orquestador ni los
 * `Paso*.tsx` necesiten ramificarse por modo.
 */
export function construirPasos(usuariaExistente: boolean): PasoWizard[] {
  return usuariaExistente ? PASOS_BASE.filter((paso) => paso.id !== 'usuaria') : PASOS_BASE
}
