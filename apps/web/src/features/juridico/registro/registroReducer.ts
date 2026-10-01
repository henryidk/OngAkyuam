import type { ProcesoEnLoteInput, TipoProcesoJuridico } from '@akyuam/shared'

/** Una fila del paso 2. Los "" son "sin asignar": el mismo contrato que espera el backend. */
export interface FilaRegistro {
  tipo: TipoProcesoJuridico
  abogadaId: string
  procuradoraId: string
  contraparte: string
  fechaInicio: string
  /** "" = sin proceso de origen. */
  procesoOrigenId: string
}

export interface EstadoRegistro {
  paso: 1 | 2
  /** En el orden en que se eligieron: la primera fila es la que se copia a las demás. */
  filas: FilaRegistro[]
}

export type CampoAsignable = Exclude<keyof FilaRegistro, 'tipo'>

export type AccionRegistro =
  /** `hoy` se inyecta: el reducer no lee el reloj, así es puro y comprobable. */
  | { type: 'TOGGLE_TIPO'; tipo: TipoProcesoJuridico; hoy: string }
  | { type: 'ASIGNAR'; tipo: TipoProcesoJuridico; campo: CampoAsignable; valor: string }
  | { type: 'COPIAR_PRIMERO_A_TODOS' }
  | { type: 'IR_A_PASO'; paso: 1 | 2 }

function filaNueva(tipo: TipoProcesoJuridico, hoy: string): FilaRegistro {
  return { tipo, abogadaId: '', procuradoraId: '', contraparte: '', fechaInicio: hoy, procesoOrigenId: '' }
}

/** Los procesos que sugirió Trabajo Social llegan ya marcados: la abogada solo confirma o quita. */
export function estadoInicial(sugeridos: TipoProcesoJuridico[], hoy: string): EstadoRegistro {
  return { paso: 1, filas: sugeridos.map((tipo) => filaNueva(tipo, hoy)) }
}

export function registroReducer(estado: EstadoRegistro, accion: AccionRegistro): EstadoRegistro {
  switch (accion.type) {
    case 'TOGGLE_TIPO': {
      const yaEsta = estado.filas.some((fila) => fila.tipo === accion.tipo)
      const filas = yaEsta
        ? estado.filas.filter((fila) => fila.tipo !== accion.tipo)
        : [...estado.filas, filaNueva(accion.tipo, accion.hoy)]
      // Quitar el último proceso desde el paso 2 devuelve a la selección: no hay nada que asignar.
      return { paso: filas.length === 0 ? 1 : estado.paso, filas }
    }
    case 'ASIGNAR':
      return {
        ...estado,
        filas: estado.filas.map((fila) => (fila.tipo === accion.tipo ? { ...fila, [accion.campo]: accion.valor } : fila)),
      }
    case 'COPIAR_PRIMERO_A_TODOS': {
      const primera = estado.filas[0]
      if (!primera) return estado
      // Solo la asignación de personal: contraparte, fecha y origen son propios de cada proceso.
      return {
        ...estado,
        filas: estado.filas.map((fila) => ({
          ...fila,
          abogadaId: primera.abogadaId,
          procuradoraId: primera.procuradoraId,
        })),
      }
    }
    case 'IR_A_PASO':
      if (accion.paso === 2 && estado.filas.length === 0) return estado
      return { ...estado, paso: accion.paso }
  }
}

export function aProcesosDeLote(filas: FilaRegistro[]): ProcesoEnLoteInput[] {
  return filas.map((fila) => ({
    tipo: fila.tipo,
    abogadaId: fila.abogadaId,
    procuradoraId: fila.procuradoraId,
    contraparte: fila.contraparte.trim(),
    fechaInicio: fila.fechaInicio,
    procesoOrigenId: fila.procesoOrigenId || null,
  }))
}
