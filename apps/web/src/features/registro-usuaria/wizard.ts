import type { FieldPath } from 'react-hook-form'
import type { RegistroUsuariaNuevaFormValues, TipoRegistro } from '@akyuam/shared'

export type PasoId = 'usuaria' | 'situacion' | 'registro' | 'hijos' | 'revision' | 'referir' | 'documentos'

/**
 * `datos`: lo que se captura antes de registrar (se valida con el formulario).
 * `seguimiento`: lo que se hace con el caso ya creado — opcional y sin volver atrás a los datos.
 */
export type FasePaso = 'datos' | 'seguimiento'

export interface PasoWizard {
  id: PasoId
  fase: FasePaso
  titulo: string
  /** Texto corto del stepper. */
  descripcion: string
  /** Texto de ayuda debajo del título de la tarjeta del paso (opcional). */
  ayuda?: string
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

/**
 * Una vez registrado el caso, los pasos de datos quedan como completados pero ya no se puede
 * volver a ellos: lo guardado se corrige desde la ficha, no reabriendo el wizard.
 */
export function calcularEstadoPasos(pasos: PasoWizard[], pasoActualId: PasoId): EstadoPaso[] {
  const indiceActual = pasos.findIndex((paso) => paso.id === pasoActualId)
  const enSeguimiento = pasos[indiceActual]?.fase === 'seguimiento'
  return pasos.map((paso, indice) => ({
    paso,
    indice,
    completado: indice < indiceActual,
    activo: indice === indiceActual,
    alcanzable: indice <= indiceActual && !(enSeguimiento && paso.fase === 'datos'),
  }))
}

// "Tipo de registro" va antes que "Hijas e hijos" (el plan los ordena al revés): la regla vigente
// solo registra niñas/niños en casos Interna, así que hay que saber el tipo antes de preguntarlo.
// "Revisión" registra el caso: referir y documentos van después porque necesitan el expediente
// ya creado (referir a un área y compartirle un escaneo requieren un caso existente).
const PASOS_BASE: PasoWizard[] = [
  {
    id: 'usuaria',
    fase: 'datos',
    titulo: 'Usuaria',
    descripcion: 'Identidad y datos demográficos',
    campos: ['datosCaso.fecha', 'datosUsuaria'],
  },
  {
    id: 'situacion',
    fase: 'datos',
    titulo: 'Situación de violencia',
    descripcion: 'Tipología, agresor, observaciones',
    ayuda: 'Datos de este caso. Si la usuaria regresa en el futuro, se registra un caso nuevo sin repetir sus datos.',
    campos: ['datosCaso.fecha', 'datosCaso.tipologiaDelito', 'datosCaso.datosAgresor', 'datosCaso.observaciones'],
  },
  {
    id: 'registro',
    fase: 'datos',
    titulo: 'Tipo de registro',
    descripcion: 'Interna o externa',
    ayuda: 'Interna si solicita albergue.',
    campos: ['datosCaso.tipoRegistro', 'datosCaso.fechaIngresoAlbergue'],
  },
  {
    id: 'hijos',
    fase: 'datos',
    titulo: 'Hijas e hijos',
    descripcion: 'Si ingresan con ella al albergue',
    ayuda: 'Solo menores de 12 años que ingresan al albergue con la usuaria. Se registran en este caso.',
    campos: ['datosCaso.ninos'],
  },
  {
    id: 'revision',
    fase: 'datos',
    titulo: 'Revisión',
    descripcion: 'Confirmar y registrar',
    ayuda: 'Revisa antes de registrar. Al registrar se crea el expediente; referir y subir documentos viene después.',
    campos: [],
  },
  {
    id: 'referir',
    fase: 'seguimiento',
    titulo: 'Referir',
    descripcion: 'A las áreas (opcional)',
    ayuda: 'Elige las áreas que atenderán a la usuaria. Puedes omitirlo y hacerlo después desde su ficha.',
    campos: [],
  },
  {
    id: 'documentos',
    fase: 'seguimiento',
    titulo: 'Documentos',
    descripcion: 'Escaneos (opcional)',
    ayuda: 'Los formularios en papel siguen siendo el original; aquí se sube la copia escaneada.',
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
