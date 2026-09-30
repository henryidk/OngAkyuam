import type { TipoCitaPsicologica } from '@akyuam/shared'

/**
 * Constructor único de las URLs del módulo (§8.1 del plan). Ningún componente arma un path de
 * psicología con un template string suelto: cuando una ruta se mueve —como pasó al sacar
 * "programar cita" de debajo de `/expedientes`— se corrige aquí y no en cada pantalla.
 */

function conQuery(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) query.set(clave, valor)
  }
  const cadena = query.toString()
  return cadena ? `${base}?${cadena}` : base
}

interface OpcionesNuevaCita {
  /** Sin expediente, el formulario arranca con su propio buscador (§5.2 del plan). */
  expedienteId?: string
  /** Precarga el tipo cuando el origen ya lo sabe (cola de primeras citas vs. de seguimiento). */
  tipo?: TipoCitaPsicologica
  /** Día preseleccionado (`YYYY-MM-DD`), normalmente el que está abierto en el calendario. */
  fecha?: string
}

export const RUTAS_PSICOLOGIA = {
  /** La agenda es la pantalla de entrada del módulo. */
  agenda: (fecha?: string) => conQuery('/psicologia', { fecha }),
  nuevaCita: ({ expedienteId, tipo, fecha }: OpcionesNuevaCita = {}) =>
    conQuery('/psicologia/agenda/nueva-cita', { expediente: expedienteId, tipo, fecha }),
  reprogramarCita: (citaId: string) =>
    conQuery('/psicologia/agenda/nueva-cita', { reprograma: citaId }),
  expediente: (expedienteId: string) => `/psicologia/expedientes/${expedienteId}`,
  detalleCita: (citaId: string) => `/psicologia/citas/${citaId}`,
  registrarConsulta: (citaId: string) => `/psicologia/citas/${citaId}/atencion`,
}
