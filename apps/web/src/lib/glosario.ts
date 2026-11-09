import { MESES_SIN_VENIR_MEDICA } from '@akyuam/shared'

export type AreaGlosario = 'medica' | 'psicologia'
export type TerminoGlosario = 'por-agendar' | 'sin-proxima' | 'sin-venir' | 'por-registrar' | 'atrasada'

export interface Definicion {
  termino: TerminoGlosario
  nombre: string
  texto: string
}

/**
 * Un solo glosario por área (plan V5.4 y MD1): "Por agendar" es quien nunca tuvo cita y "Sin
 * próxima" quien ya se atendió y no tiene fecha. Cada aviso enlaza aquí en vez de explicarse a
 * su manera. El orden sigue el recorrido de una persona: referida, atendida, por registrar.
 */
export const GLOSARIO: Record<AreaGlosario, readonly Definicion[]> = {
  medica: [
    {
      termino: 'por-agendar',
      nombre: 'Por agendar',
      texto: 'Paciente referida por Trabajo Social que todavía no tiene su primera consulta. Está en el Área de atención.',
    },
    {
      termino: 'sin-proxima',
      nombre: 'Sin próxima consulta',
      texto: 'Ya se atendió, sigue en atención y no tiene ninguna cita programada. La lista está en Pacientes.',
    },
    {
      termino: 'sin-venir',
      nombre: 'Sin venir',
      texto: `Sin próxima consulta, y su última consulta o inasistencia fue hace más de ${MESES_SIN_VENIR_MEDICA} meses. Agéndala o dale de alta.`,
    },
    {
      termino: 'por-registrar',
      nombre: 'Por registrar',
      texto: 'Una cita que ya empezó y todavía no tiene registrada la consulta ni la inasistencia.',
    },
    {
      termino: 'atrasada',
      nombre: 'Atrasada',
      texto: 'Una cita por registrar de un día anterior a hoy. Se registra igual, desde Consultas.',
    },
  ],
  psicologia: [
    {
      termino: 'por-agendar',
      nombre: 'Por agendar',
      texto: 'Caso tomado que todavía no tiene su primera cita. Al programarla se abre el proceso.',
    },
    {
      termino: 'sin-proxima',
      nombre: 'Sin próxima cita',
      texto: 'Proceso activo que no tiene ninguna cita programada. Se revisa en Procesos.',
    },
    {
      termino: 'por-registrar',
      nombre: 'Por registrar',
      texto: 'Una cita que ya empezó y todavía no tiene registrada la sesión ni la inasistencia.',
    },
    {
      termino: 'atrasada',
      nombre: 'Atrasada',
      texto: 'Una cita por registrar de un día anterior a hoy. Se registra igual, desde Consultas.',
    },
  ],
}
