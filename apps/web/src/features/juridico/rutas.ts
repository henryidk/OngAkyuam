/**
 * Constructor único de las URLs del módulo (mismo criterio que `RUTAS_PSICOLOGIA`): ningún
 * componente arma un path de jurídico con un template string suelto.
 */

function conQuery(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) query.set(clave, valor)
  }
  const cadena = query.toString()
  return cadena ? `${base}?${cadena}` : base
}

interface OpcionesRegistro {
  expedienteId: string
  /** Presente cuando se entra desde "Atender caso" de una referencia de la bandeja. */
  referidoId?: string
}

export const RUTAS_JURIDICO = {
  /** El Área de atención (bandeja de referencias) es la pantalla de entrada del módulo. */
  bandeja: () => '/juridico',
  /** Solo procesos en trámite; `mios` deja los asignados a la cuenta actual (abogada o procuradora). */
  procesos: ({ mios }: { mios?: boolean } = {}) => conQuery('/juridico/procesos', { mios: mios ? 'true' : undefined }),
  registrar: ({ expedienteId, referidoId }: OpcionesRegistro) =>
    conQuery('/juridico/procesos/registrar', { expediente: expedienteId, referido: referidoId }),
  proceso: (procesoId: string) => `/juridico/procesos/${procesoId}`,
  documentosProceso: (procesoId: string) => `/juridico/procesos/${procesoId}/documentos`,
  usuarias: () => '/juridico/usuarias',
  /** Pestaña Resumen de la ficha; las demás cuelgan de la misma ruta. */
  usuaria: (usuariaId: string) => `/juridico/usuarias/${usuariaId}`,
  usuariaProcesos: (usuariaId: string) => `/juridico/usuarias/${usuariaId}/procesos`,
  usuariaDatos: (usuariaId: string) => `/juridico/usuarias/${usuariaId}/datos`,
  usuariaDocumentos: (usuariaId: string) => `/juridico/usuarias/${usuariaId}/documentos`,
  usuariaReferencias: (usuariaId: string) => `/juridico/usuarias/${usuariaId}/referencias`,
}
