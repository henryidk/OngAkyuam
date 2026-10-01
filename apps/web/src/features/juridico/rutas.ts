import type { FiltroEstadoProceso, FormaFinalizacionProceso } from '@akyuam/shared'

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

interface FiltrosLista {
  estado?: FiltroEstadoProceso
  forma?: FormaFinalizacionProceso
  requiereAtencion?: boolean
}

interface OpcionesRegistro {
  expedienteId: string
  /** Presente cuando se entra desde "Atender caso" de una referencia de la bandeja. */
  referidoId?: string
}

export const RUTAS_JURIDICO = {
  /** El Área de atención (bandeja de referencias) es la pantalla de entrada del módulo. */
  bandeja: () => '/juridico',
  procesos: ({ estado, forma, requiereAtencion }: FiltrosLista = {}) =>
    conQuery('/juridico/procesos', { estado, forma, requiereAtencion: requiereAtencion ? 'true' : undefined }),
  registrar: ({ expedienteId, referidoId }: OpcionesRegistro) =>
    conQuery('/juridico/procesos/registrar', { expediente: expedienteId, referido: referidoId }),
  proceso: (procesoId: string) => `/juridico/procesos/${procesoId}`,
  documentosProceso: (procesoId: string) => `/juridico/procesos/${procesoId}/documentos`,
  expedientes: () => '/juridico/expedientes',
  usuaria: (usuariaId: string) => `/juridico/usuarias/${usuariaId}`,
}
