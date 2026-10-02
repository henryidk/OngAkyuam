import type { EditarIdentidadUsuariaInput, UsuariaExpedienteHub } from '@akyuam/shared'

export const DEPARTAMENTO_ALTA_VERAPAZ = 'Alta Verapaz'

type CamposUbicacion = Pick<
  EditarIdentidadUsuariaInput,
  'fueraDeAltaVerapaz' | 'municipio' | 'departamentoOtro' | 'municipioOtro'
>

/**
 * El formulario muestra un solo select "Departamento"; el schema guarda la ubicación en
 * `fueraDeAltaVerapaz` + campos separados. Devuelve los campos que cambian al elegir un
 * departamento: lo que deja de aplicar se limpia para no enviar datos contradictorios.
 */
export function mapearDepartamento(departamento: string): Partial<CamposUbicacion> {
  if (departamento === DEPARTAMENTO_ALTA_VERAPAZ) {
    return { fueraDeAltaVerapaz: false, departamentoOtro: '', municipioOtro: '' }
  }
  return { fueraDeAltaVerapaz: true, departamentoOtro: departamento, municipio: '' }
}

/** Valores del formulario a partir de la usuaria guardada: `null` se edita como texto vacío. */
export function valoresIdentidad(usuaria: UsuariaExpedienteHub): EditarIdentidadUsuariaInput {
  return {
    nombres: usuaria.nombres,
    apellidos: usuaria.apellidos,
    dpi: usuaria.dpi ?? '',
    telefono: usuaria.telefono ?? '',
    direccion: usuaria.direccion ?? '',
    fechaNacimiento: usuaria.fechaNacimiento,
    grupoEtnico: usuaria.grupoEtnico as EditarIdentidadUsuariaInput['grupoEtnico'],
    fueraDeAltaVerapaz: usuaria.municipio === null,
    municipio: usuaria.municipio ?? '',
    departamentoOtro: usuaria.departamentoOtro ?? '',
    municipioOtro: usuaria.municipioOtro ?? '',
    ubicacionGeografica: usuaria.ubicacionGeografica ?? '',
  }
}

/** Campos tal como los ve quien edita, en el orden de la cuadrícula. */
export const CAMPOS_VISIBLES_IDENTIDAD = [
  'nombres',
  'apellidos',
  'dpi',
  'fechaNacimiento',
  'grupoEtnico',
  'telefono',
  'departamento',
  'municipio',
  'ubicacionGeografica',
  'direccion',
] as const

export type CampoVisibleIdentidad = (typeof CAMPOS_VISIBLES_IDENTIDAD)[number]

/** Campos del schema detrás de cada campo visible: "Departamento" y "Municipio" agrupan dos. */
const CAMPOS_DEL_SCHEMA: Record<CampoVisibleIdentidad, readonly (keyof EditarIdentidadUsuariaInput)[]> = {
  nombres: ['nombres'],
  apellidos: ['apellidos'],
  dpi: ['dpi'],
  fechaNacimiento: ['fechaNacimiento'],
  grupoEtnico: ['grupoEtnico'],
  telefono: ['telefono'],
  departamento: ['fueraDeAltaVerapaz', 'departamentoOtro'],
  municipio: ['municipio', 'municipioOtro'],
  ubicacionGeografica: ['ubicacionGeografica'],
  direccion: ['direccion'],
}

/** Cuenta lo que la persona percibe como un cambio, no los campos internos del schema. */
export function camposVisiblesModificados(
  camposSucios: Partial<Record<keyof EditarIdentidadUsuariaInput, boolean>>,
): CampoVisibleIdentidad[] {
  return CAMPOS_VISIBLES_IDENTIDAD.filter((campo) =>
    CAMPOS_DEL_SCHEMA[campo].some((delSchema) => camposSucios[delSchema] === true),
  )
}
