import type { FieldPath } from 'react-hook-form'
import type { RegistroUsuariaNuevaFormValues, TipoRegistro } from '@akyuam/shared'

export type PasoId = 'usuaria' | 'situacion' | 'registro' | 'hijos' | 'documentos' | 'revision'

export interface PasoWizard {
  id: PasoId
  titulo: string
  /** Texto corto del stepper. */
  descripcion: string
  /** Texto de ayuda debajo del título de la tarjeta del paso. */
  ayuda: string
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

// "Tipo de registro" va antes que "Hijas e hijos" (el plan los ordena al revés): la regla vigente
// solo registra niñas/niños en casos Interna, así que hay que saber el tipo antes de preguntarlo.
const PASOS_BASE: PasoWizard[] = [
  {
    id: 'usuaria',
    titulo: 'Usuaria',
    descripcion: 'Identidad y datos demográficos',
    ayuda:
      'Todo lo de la usuaria en un solo lugar: estos datos también alimentan el reporte de población beneficiada.',
    campos: ['datosCaso.fecha', 'datosUsuaria'],
  },
  {
    id: 'situacion',
    titulo: 'Situación de violencia',
    descripcion: 'Tipología, agresor, observaciones',
    ayuda: 'Datos de este caso. Si la usuaria regresa en el futuro, se registra un caso nuevo sin repetir sus datos.',
    campos: ['datosCaso.fecha', 'datosCaso.tipologiaDelito', 'datosCaso.datosAgresor', 'datosCaso.observaciones'],
  },
  {
    id: 'registro',
    titulo: 'Tipo de registro',
    descripcion: 'Interna o externa',
    ayuda: 'Interna si solicita albergue.',
    campos: ['datosCaso.tipoRegistro', 'datosCaso.fechaIngresoAlbergue'],
  },
  {
    id: 'hijos',
    titulo: 'Hijas e hijos',
    descripcion: 'Si ingresan con ella al albergue',
    ayuda: 'Solo menores de 12 años que ingresan al albergue con la usuaria. Se registran en este caso.',
    campos: ['datosCaso.ninos'],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    descripcion: 'Escaneos (opcional ahora)',
    ayuda: 'Los formularios en papel siguen siendo el original; aquí se sube la copia escaneada.',
    campos: [],
  },
  {
    id: 'revision',
    titulo: 'Revisión',
    descripcion: 'Confirmar y guardar',
    ayuda: 'Revisa antes de registrar. Luego podrás referirla a las áreas.',
    campos: [],
  },
]

/**
 * Único lugar que decide qué pasos existen (OCP): si la usuaria ya existe se omite su identidad
 * (ya se capturó antes), y "Hijas e hijos" solo aparece en casos Interna — el orquestador y los
 * `Paso*.tsx` no se ramifican por modo.
 */
export function construirPasos(usuariaExistente: boolean, tipoRegistro: TipoRegistro | ''): PasoWizard[] {
  return PASOS_BASE.filter((paso) => {
    if (paso.id === 'usuaria') return !usuariaExistente
    if (paso.id === 'hijos') return tipoRegistro === 'INTERNA'
    return true
  })
}
