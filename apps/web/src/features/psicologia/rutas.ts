import type { FiltroProcesosPsicologia, FiltroUsuariasPsicologia } from '@akyuam/shared'

/**
 * Constructor único de las URLs del módulo. Ningún componente arma un path de psicología con un
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

export const RUTAS_PSICOLOGIA = {
  /** Pantalla de entrada del módulo: las referencias de Trabajo Social que nadie ha tomado. */
  atencion: () => '/psicologia/atencion',
  /**
   * `dia` (`YYYY-MM-DD`) abre la agenda en ese día y en su semana; sin él, en hoy. `porAgendar`
   * resalta el caso recién tomado en el panel "Casos tomados por agendar".
   */
  agenda: (dia?: string, porAgendar?: string) => conQuery('/psicologia/agenda', { dia, porAgendar }),
  procesos: (filtro?: FiltroProcesosPsicologia) => conQuery('/psicologia/procesos', { filtro }),
  /**
   * `sesion` (id de la cita) abre el detalle con esa sesión ya desplegada. `cerrar` lo abre con
   * el modal de cierre a la vista: así llega quien eligió "Cerrar proceso" al registrar una sesión.
   */
  proceso: (procesoId: string, sesion?: string, cerrar?: boolean) =>
    conQuery(`/psicologia/procesos/${procesoId}`, { sesion, cerrar: cerrar ? '1' : undefined }),
  documentosProceso: (procesoId: string) => `/psicologia/procesos/${procesoId}/documentos`,
  usuarias: (filtro?: FiltroUsuariasPsicologia) => conQuery('/psicologia/usuarias', { filtro }),
  usuaria: (usuariaId: string) => `/psicologia/usuarias/${usuariaId}`,
  usuariaProcesos: (usuariaId: string) => `/psicologia/usuarias/${usuariaId}/procesos`,
  usuariaDatos: (usuariaId: string) => `/psicologia/usuarias/${usuariaId}/datos`,
  usuariaDocumentos: (usuariaId: string) => `/psicologia/usuarias/${usuariaId}/documentos`,
  usuariaReferencias: (usuariaId: string) => `/psicologia/usuarias/${usuariaId}/referencias`,
  reportes: () => '/psicologia/reportes',
  detalleCita: (citaId: string) => `/psicologia/citas/${citaId}`,
  registrarConsulta: (citaId: string) => `/psicologia/citas/${citaId}/atencion`,
}
