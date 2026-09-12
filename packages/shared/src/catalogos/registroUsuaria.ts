/**
 * Catálogos fijos usados por el formulario de registro de usuaria y, a
 * futuro, por el backend (mismo criterio que los schemas de Zod: una sola
 * fuente de verdad compartida entre frontend y backend).
 */

export const DEPARTAMENTOS_GUATEMALA = [
  'Guatemala',
  'El Progreso',
  'Sacatepéquez',
  'Chimaltenango',
  'Escuintla',
  'Santa Rosa',
  'Sololá',
  'Totonicapán',
  'Quetzaltenango',
  'Suchitepéquez',
  'Retalhuleu',
  'San Marcos',
  'Huehuetenango',
  'Quiché',
  'Baja Verapaz',
  'Alta Verapaz',
  'Petén',
  'Izabal',
  'Zacapa',
  'Chiquimula',
  'Jalapa',
  'Jutiapa',
] as const

export const GRUPOS_ETNICOS = ['MAYA_QECHI', 'MAYA_POQOMCHI', 'XINCA', 'GARIFUNA', 'LADINO', 'OTRO'] as const

export const ETIQUETAS_GRUPO_ETNICO: Record<(typeof GRUPOS_ETNICOS)[number], string> = {
  MAYA_QECHI: "Maya Q'eqchi'",
  MAYA_POQOMCHI: "Maya Poqomchi'",
  XINCA: 'Xinca',
  GARIFUNA: 'Garífuna',
  LADINO: 'Ladino',
  OTRO: 'Otro',
}

/** Catálogo fijo de los 17 municipios de Alta Verapaz (incluye Raxruhá, segregado de Chisec). */
export const MUNICIPIOS_ALTA_VERAPAZ = [
  'COBAN',
  'SANTA_CRUZ_VERAPAZ',
  'SAN_CRISTOBAL_VERAPAZ',
  'TACTIC',
  'TAMAHU',
  'TUCURU',
  'PANZOS',
  'SENAHU',
  'SAN_PEDRO_CARCHA',
  'SAN_JUAN_CHAMELCO',
  'LANQUIN',
  'CAHABON',
  'CHISEC',
  'CHAHAL',
  'FRAY_BARTOLOME_DE_LAS_CASAS',
  'RAXRUHA',
  'SANTA_CATALINA_LA_TINTA',
] as const

export const ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ: Record<(typeof MUNICIPIOS_ALTA_VERAPAZ)[number], string> = {
  COBAN: 'Cobán',
  SANTA_CRUZ_VERAPAZ: 'Santa Cruz Verapaz',
  SAN_CRISTOBAL_VERAPAZ: 'San Cristóbal Verapaz',
  TACTIC: 'Tactic',
  TAMAHU: 'Tamahú',
  TUCURU: 'Tucurú',
  PANZOS: 'Panzós',
  SENAHU: 'Senahú',
  SAN_PEDRO_CARCHA: 'San Pedro Carchá',
  SAN_JUAN_CHAMELCO: 'San Juan Chamelco',
  LANQUIN: 'Lanquín',
  CAHABON: 'Cahabón',
  CHISEC: 'Chisec',
  CHAHAL: 'Chahal',
  FRAY_BARTOLOME_DE_LAS_CASAS: 'Fray Bartolomé de las Casas',
  RAXRUHA: 'Raxruhá',
  SANTA_CATALINA_LA_TINTA: 'Santa Catalina La Tinta',
}

export const TIPOLOGIAS_DELITO = ['FISICA', 'PSICOLOGICA', 'ECONOMICA_PATRIMONIAL', 'SEXUAL'] as const

export const ETIQUETAS_TIPOLOGIA_DELITO: Record<(typeof TIPOLOGIAS_DELITO)[number], string> = {
  FISICA: 'Física',
  PSICOLOGICA: 'Psicológica',
  ECONOMICA_PATRIMONIAL: 'Económica/Patrimonial',
  SEXUAL: 'Sexual',
}

export const GENEROS = ['M', 'H'] as const

export const ETIQUETAS_GENERO: Record<(typeof GENEROS)[number], string> = {
  M: 'Mujer',
  H: 'Hombre',
}

export const AREAS_ATENCION = ['JURIDICO', 'PSICOLOGIA', 'MEDICA'] as const

export const ETIQUETAS_AREA_ATENCION: Record<(typeof AREAS_ATENCION)[number], string> = {
  JURIDICO: 'Jurídica',
  PSICOLOGIA: 'Psicológica',
  MEDICA: 'Médica',
}

export const TIPOS_REGISTRO = ['INTERNA', 'EXTERNA'] as const

export const ETIQUETAS_TIPO_REGISTRO: Record<(typeof TIPOS_REGISTRO)[number], string> = {
  INTERNA: 'Interna (solicita albergue)',
  EXTERNA: 'Externa',
}

export type RangoEdad = '0-13' | '14-30' | '31-60' | 'MAYOR_60'

export const ETIQUETAS_RANGO_EDAD: Record<RangoEdad, string> = {
  '0-13': '0 a 13 años',
  '14-30': '14 a 30 años',
  '31-60': '31 a 60 años',
  MAYOR_60: 'Mayor de 60 años',
}

/** Edad máxima (sin incluir) para registrar a un hijo/hija como población beneficiada junto a la usuaria. */
export const EDAD_MAXIMA_NINOS = 12

export function calcularRangoEdad(edadAnios: number): RangoEdad {
  if (edadAnios <= 13) return '0-13'
  if (edadAnios <= 30) return '14-30'
  if (edadAnios <= 60) return '31-60'
  return 'MAYOR_60'
}
