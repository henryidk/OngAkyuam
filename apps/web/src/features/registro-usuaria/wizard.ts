import type { FieldPath } from 'react-hook-form'
import type { RegistroUsuariaFormValues } from '@akyuam/shared'

export type PasoId = 'caso' | 'usuaria' | 'agresor' | 'registro' | 'areas' | 'documentos' | 'revision'

export interface PasoWizard {
  id: PasoId
  titulo: string
  descripcion: string
  /** Rutas del formulario a validar antes de avanzar a este paso. Vacío = sin datos propios que validar. */
  campos: FieldPath<RegistroUsuariaFormValues>[]
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

export const PASOS_REGISTRO_USUARIA: PasoWizard[] = [
  {
    id: 'caso',
    titulo: 'Datos del caso',
    descripcion: 'Fecha y ubicación del registro.',
    campos: ['datosCaso'],
  },
  {
    id: 'usuaria',
    titulo: 'Datos de la usuaria',
    descripcion: 'Identificación y datos para estadística de población beneficiada.',
    campos: ['datosUsuaria'],
  },
  {
    id: 'agresor',
    titulo: 'Datos del agresor',
    descripcion: 'Solo si la usuaria los proporcionó.',
    campos: ['datosAgresor'],
  },
  {
    id: 'registro',
    titulo: 'Tipo de registro',
    descripcion: 'Interna (solicita albergue) o externa, y niñas o niños si aplica.',
    campos: ['tipoRegistro', 'ninos'],
  },
  {
    id: 'areas',
    titulo: 'Áreas de atención',
    descripcion: 'Refiere el caso a las áreas que deban tener acceso a esta información.',
    campos: ['areasReferidas'],
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
