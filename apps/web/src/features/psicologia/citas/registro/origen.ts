import { RUTAS_PSICOLOGIA, type OrigenSesion } from '../../rutas'

export const VOLVER_A: Record<OrigenSesion, string> = {
  atencion: 'Volver a Área de atención',
  agenda: 'Volver a la agenda',
  consultas: 'Volver a Consultas',
  proceso: 'Volver al proceso',
}

/** `?origen=` de la URL; cualquier otro valor (o ninguno) vuelve al proceso. */
export function origenDeParametro(valor: string | null): OrigenSesion {
  return valor === 'atencion' || valor === 'agenda' || valor === 'consultas' ? valor : 'proceso'
}

/**
 * A dónde se vuelve: la pantalla de origen (el Área de atención, la Agenda en el día de la
 * sesión, Consultas › Por registrar) o, por defecto, el proceso. `procesoId` null = el proceso
 * todavía no existe ("Atender ahora"): se vuelve al Área de atención.
 */
export function rutaDeOrigen(origen: OrigenSesion, procesoId: string | null, diaSesion: string): string {
  if (origen === 'agenda') return RUTAS_PSICOLOGIA.agenda(diaSesion)
  if (origen === 'consultas') return RUTAS_PSICOLOGIA.consultas('por-registrar')
  if (origen === 'atencion' || !procesoId) return RUTAS_PSICOLOGIA.atencion()
  return RUTAS_PSICOLOGIA.proceso(procesoId)
}

/** Las migas del registro según desde dónde se abrió. */
export function migasDelRegistro(
  origen: OrigenSesion,
  proceso: { id: string; codigo: string } | null,
  diaSesion: string | undefined,
) {
  if (origen === 'atencion') return [{ etiqueta: 'Área de atención', ruta: RUTAS_PSICOLOGIA.atencion() }]
  if (origen === 'agenda') return [{ etiqueta: 'Agenda', ruta: RUTAS_PSICOLOGIA.agenda(diaSesion) }]
  if (origen === 'consultas') return [{ etiqueta: 'Consultas', ruta: RUTAS_PSICOLOGIA.consultas('por-registrar') }]
  const procesos = { etiqueta: 'Procesos', ruta: RUTAS_PSICOLOGIA.procesos() }
  return proceso ? [procesos, { etiqueta: proceso.codigo, ruta: RUTAS_PSICOLOGIA.proceso(proceso.id) }] : [procesos]
}
