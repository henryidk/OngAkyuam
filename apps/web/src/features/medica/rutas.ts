import type { FiltroPacientesMedica } from '@akyuam/shared'

/**
 * Constructor único de las URLs del módulo. Ningún componente arma un path de medicina con un
 * template string suelto: cuando una ruta se mueve, se corrige aquí y no en cada pantalla.
 */

function conQuery(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) query.set(clave, valor)
  }
  const cadena = query.toString()
  return cadena ? `${base}?${cadena}` : base
}

/** De dónde se abrió el registro de una consulta: al guardar se vuelve ahí (regla 1.7). */
export type OrigenConsulta = 'agenda' | 'ficha'

export const RUTAS_MEDICA = {
  /** Pantalla de entrada: referencias pendientes de primera consulta. */
  atencion: () => '/medica/atencion',
  /**
   * `dia` (`YYYY-MM-DD`) abre la agenda en ese día y su semana; sin él, en hoy. `agendar` (id de
   * la referencia) abre el modal "Agendar primera consulta" con esa paciente.
   */
  agenda: (dia?: string, agendar?: string) => conQuery('/medica/agenda', { dia, agendar }),
  pacientes: (estado?: FiltroPacientesMedica, q?: string) => conQuery('/medica/pacientes', { estado, q }),
  paciente: (usuariaId: string) => `/medica/pacientes/${usuariaId}`,
  /** `persona`: "usuaria" o el id de un hijo/a. `consulta`: la que se abre desplegada. */
  historia: (usuariaId: string, persona?: string, consulta?: string) =>
    conQuery(`/medica/pacientes/${usuariaId}/historia`, { persona, consulta }),
  documentos: (usuariaId: string) => `/medica/pacientes/${usuariaId}/documentos`,
  datos: (usuariaId: string) => `/medica/pacientes/${usuariaId}/datos`,
  /** Registrar consulta desde una cita (`cita`) o, de forma excepcional, sin cita (`usuaria`). */
  nuevaConsulta: (params: { cita?: string; usuaria?: string; origen: OrigenConsulta }) =>
    conQuery('/medica/consultas/nueva', params),
  reportes: (anio?: number, mes?: number) =>
    conQuery('/medica/reportes', { anio: anio?.toString(), mes: mes?.toString() }),
}
