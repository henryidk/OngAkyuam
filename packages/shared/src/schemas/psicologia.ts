import { z } from 'zod'
import {
  DURACION_CITA_PSICOLOGICA_MINUTOS_DEFAULT,
  ESTADOS_ATENCION_PSICOLOGICA,
  ESTADOS_CITA_PSICOLOGICA,
  MODALIDADES_CITA,
  TIPOS_CITA_PSICOLOGICA,
} from '../catalogos/psicologia.js'
import { MUNICIPIOS_ALTA_VERAPAZ } from '../catalogos/registroUsuaria.js'
import type { TipoDocumento } from './documentos.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** Valor crudo de un `<input type="datetime-local">` — se interpreta como hora de Guatemala vía `parseLocalGT`, nunca como UTC directo. */
const fechaHoraLocalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha y hora inválidas')

export const modalidadCitaSchema = z.enum(MODALIDADES_CITA)
export const estadoCitaPsicologicaSchema = z.enum(ESTADOS_CITA_PSICOLOGICA)
export const estadoAtencionPsicologicaSchema = z.enum(ESTADOS_ATENCION_PSICOLOGICA)
export const tipoCitaPsicologicaSchema = z.enum(TIPOS_CITA_PSICOLOGICA)

export const programarCitaSchema = z.object({
  fechaHora: fechaHoraLocalSchema,
  modalidad: modalidadCitaSchema,
  lugar: z.string(),
  motivo: z.string().min(1, 'Requerido'),
  tipo: tipoCitaPsicologicaSchema.default('SEGUIMIENTO'),
  duracionMinutos: z.number().int().positive().default(DURACION_CITA_PSICOLOGICA_MINUTOS_DEFAULT),
  /** true solo en el reintento tras que la psicóloga confirmó el aviso de traslape (§7.5 del plan). */
  confirmarTraslape: z.boolean().default(false),
})
export type ProgramarCitaInput = z.infer<typeof programarCitaSchema>

/** PATCH al atender/cancelar una cita — `observaciones`/`acuerdos` son texto libre opcional ("" = sin dato, mismo criterio que datosAgresor). */
export const actualizarCitaSchema = z.object({
  estado: estadoCitaPsicologicaSchema,
  observaciones: z.string(),
  acuerdos: z.string(),
})
export type ActualizarCitaInput = z.infer<typeof actualizarCitaSchema>

/** `motivo` es obligatorio solo al cerrar (§7.4 del plan) — en el resto de transiciones es texto libre opcional para la hoja de hitos. */
export const actualizarEstadoAtencionSchema = z
  .object({
    estado: estadoAtencionPsicologicaSchema,
    motivo: z.string(),
  })
  .refine((datos) => datos.estado !== 'CIERRE' || datos.motivo.trim().length > 0, {
    message: 'El motivo de cierre es requerido',
    path: ['motivo'],
  })
export type ActualizarEstadoAtencionInput = z.infer<typeof actualizarEstadoAtencionSchema>

/**
 * `POST /psicologia/citas/:id/reprogramar` — crea la cita nueva y marca la anterior
 * REPROGRAMADA en una transacción (§7.5 del plan); mismos campos que programar porque
 * conceptualmente es "una cita nueva que reemplaza a otra".
 */
export const reprogramarCitaSchema = z.object({
  fechaHora: fechaHoraLocalSchema,
  modalidad: modalidadCitaSchema,
  lugar: z.string(),
  motivo: z.string().min(1, 'Requerido'),
  /** true solo en el reintento tras que la psicóloga confirmó el aviso de traslape (§7.5 del plan). */
  confirmarTraslape: z.boolean().default(false),
})
export type ReprogramarCitaInput = z.infer<typeof reprogramarCitaSchema>

/**
 * `PUT /psicologia/citas/:id/registro` — registro clínico de la consulta (§5.4, §7.3 del
 * plan). `borrador: true` permite guardar sin finalizar; los campos de texto son libres
 * opcionales ("" = sin dato, mismo criterio que el resto del sistema).
 */
export const registroConsultaSchema = z
  .object({
    estado: estadoCitaPsicologicaSchema,
    temas: z.string(),
    intervencion: z.string(),
    recomendaciones: z.string(),
    acuerdos: z.string(),
    observaciones: z.string(),
    motivoNoAsistencia: z.string(),
    borrador: z.boolean().default(false),
  })
  .refine(
    (datos) =>
      datos.borrador || datos.estado === 'ATENDIDA' || datos.motivoNoAsistencia.trim().length > 0,
    {
      message: 'El motivo es requerido cuando la cita no fue atendida',
      path: ['motivoNoAsistencia'],
    },
  )
export type RegistroConsultaInput = z.infer<typeof registroConsultaSchema>

/** `POST /psicologia/expedientes/:id/tomar` no lleva body — la identidad de quien reclama viene del JWT. */

/** Query compartido por `GET /psicologia/agenda` y `GET /psicologia/reporte`. */
export const rangoFechasQuerySchema = z.object({
  desde: fechaCalendarioSchema,
  hasta: fechaCalendarioSchema,
})
export type RangoFechasQuery = z.infer<typeof rangoFechasQuerySchema>

/** `GET /psicologia/agenda/resumen` — cortes de mes en Guatemala (§7.5 del plan), nunca un rango libre. */
export const agendaResumenQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
})
export type AgendaResumenQuery = z.infer<typeof agendaResumenQuerySchema>

/**
 * `GET /psicologia/expedientes` — búsqueda paginada por cursor (§7.3/§7.5 del plan: nunca
 * `findMany` sin `take`). Siempre "mis" expedientes tomados — sin selector de psicóloga, mismo
 * criterio que `listarAgenda` (sin rol de coordinación en este alcance, §12 del plan).
 */
export const buscarExpedientesQuerySchema = z.object({
  q: z.string().trim().min(3).optional(),
  estado: estadoAtencionPsicologicaSchema.optional(),
  municipio: z.enum(MUNICIPIOS_ALTA_VERAPAZ).optional(),
  cursor: z.string().optional(),
})
export type BuscarExpedientesQuery = z.infer<typeof buscarExpedientesQuerySchema>

/** `GET /psicologia/expedientes/:id/citas` — historial paginado por cursor (§5.3, §7.5 del plan). */
export const historialCitasQuerySchema = z.object({
  estado: estadoCitaPsicologicaSchema.optional(),
  cursor: z.string().optional(),
})
export type HistorialCitasQuery = z.infer<typeof historialCitasQuerySchema>

/** `GET /psicologia/indicadores` — siempre "mis" casos del año consultado (§5.5, §7.4 del plan). */
export const indicadoresQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
})
export type IndicadoresQuery = z.infer<typeof indicadoresQuerySchema>

// ---- DTOs de respuesta (misma forma consumida por backend y frontend) ----

export type ModalidadCita = z.infer<typeof modalidadCitaSchema>
export type EstadoCitaPsicologica = z.infer<typeof estadoCitaPsicologicaSchema>
export type EstadoAtencionPsicologica = z.infer<typeof estadoAtencionPsicologicaSchema>
export type TipoCitaPsicologica = z.infer<typeof tipoCitaPsicologicaSchema>

export interface DocumentoCitaDto {
  id: string
  tipo: TipoDocumento
  nombreArchivo: string
  tamanioBytes: number
  createdAt: string
}

export interface CitaResumen {
  id: string
  fechaHora: string
  modalidad: ModalidadCita
  lugar: string | null
  motivo: string
  tipo: TipoCitaPsicologica
  duracionMinutos: number
  estado: EstadoCitaPsicologica
  observaciones: string | null
  acuerdos: string | null
  motivoNoAsistencia: string | null
  temas: string | null
  intervencion: string | null
  recomendaciones: string | null
  borrador: boolean
  reprogramadaDesdeId: string | null
  atendidoPor: string
  documento: DocumentoCitaDto | null
}

/** Una fila de la hoja de hitos (`CambioEstadoAtencion`) — historial inmutable de transiciones. */
export interface CambioEstadoAtencionResumen {
  id: string
  estadoAnterior: EstadoAtencionPsicologica | null
  estadoNuevo: EstadoAtencionPsicologica
  motivo: string | null
  registradoPor: string
  createdAt: string
}

export interface AtencionPsicologicaDetalle {
  id: string
  expedienteId: string
  estado: EstadoAtencionPsicologica
  psicologaAsignada: string | null
  tomadaEn: string | null
  fechaInicio: string | null
  fechaCierre: string | null
  motivoCierre: string | null
  actualizadoPor: string
  actualizadoEn: string
  citas: CitaResumen[]
  historialEstados: CambioEstadoAtencionResumen[]
}

/** Fila de `GET /psicologia/referencias-sin-tomar` — cola del área, sin `psicologaAsignadaId` todavía. */
export interface ReferenciaSinTomar {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
  fechaReferido: string
}

/** Fila de `GET /psicologia/agenda` — incluye datos mínimos para ubicar a la usuaria sin abrir el expediente. */
export interface AgendaCita extends CitaResumen {
  expedienteId: string
  usuariaNombreCompleto: string
}

/** Cuerpo del 409 de `programarCita`/`reprogramarCita` cuando hay traslape (§7.5 del plan: aviso, no bloqueo duro). */
export interface ConflictoTraslapeCita {
  mensaje: string
  citasEnConflicto: CitaResumen[]
}

export interface ReportePsicologia {
  desde: string
  hasta: string
  totalCitas: number
  porEstado: Record<EstadoCitaPsicologica, number>
  porModalidad: Record<ModalidadCita, number>
  usuariasAtendidas: number
}

// ---- Fase 6: tablero, búsqueda de expedientes, historial e indicadores ----

/** Fila del bloque "procesos sin próxima cita" del tablero (§5.1 del plan). */
export interface ProcesoSinProximaCita {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
  estado: EstadoAtencionPsicologica
  ultimaCitaFechaHora: string | null
}

/** Fila del bloque "cerrados esta semana" del tablero (§5.1 del plan). */
export interface CasoCerradoResumen {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
  fechaCierre: string
  motivoCierre: string | null
}

/** `GET /psicologia/tablero` — un bloque por cada sección de §5.1, cada fila enlaza a su propia sección (regla dura del plan). */
export interface TableroPsicologia {
  metricas: {
    totalCasosActivos: number
    citasHoyCount: number
    referenciasSinTomarCount: number
  }
  citasHoy: AgendaCita[]
  referenciasSinTomar: ReferenciaSinTomar[]
  procesosSinProximaCita: ProcesoSinProximaCita[]
  cerradosEstaSemana: CasoCerradoResumen[]
}

/** Fila de `GET /psicologia/agenda/resumen` — un día del mes consultado, nunca las citas completas (§5.2 del plan). */
export interface AgendaResumenDia {
  fecha: string
  totalCitas: number
  porEstado: Record<EstadoCitaPsicologica, number>
}

/** Fila de `GET /psicologia/expedientes` — resultado de búsqueda, solo casos tomados por mí. */
export interface ExpedienteResumenBusqueda {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
  estado: EstadoAtencionPsicologica
  municipio: string | null
}

/** Página de resultados con cursor — forma compartida por toda la paginación por cursor del módulo (§7.5 del plan). */
export interface PaginaConCursor<T> {
  items: T[]
  siguienteCursor: string | null
}

export type ExpedientesPaginados = PaginaConCursor<ExpedienteResumenBusqueda>
export type CitasPaginadas = PaginaConCursor<CitaResumen>

/**
 * `GET /psicologia/expedientes/:id/resumen` — tab "Resumen del proceso" (§5.3 del plan). No
 * incluye el listado completo de citas: eso es `GET .../citas`, paginado aparte.
 */
export interface ExpedienteResumenPsicologia {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
  estado: EstadoAtencionPsicologica
  psicologaAsignada: string | null
  tomadaEn: string | null
  fechaInicio: string | null
  fechaCierre: string | null
  motivoCierre: string | null
  historialEstados: CambioEstadoAtencionResumen[]
  totalCitas: number
  proximaCita: AgendaCita | null
}

/** `GET /psicologia/citas/:id` — permalink de una cita puntual, cada fila del historial enlaza aquí (§5.3 del plan). */
export interface CitaPsicologicaDetalle extends CitaResumen {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
}

/** `GET /psicologia/indicadores` — siempre "mis" casos del año consultado (§5.5, §7.4 del plan). */
export interface IndicadoresPsicologia {
  anio: number
  procesosActivos: number
  procesosIniciadosEnElAnio: number
  procesosCerradosEnElAnio: number
  personasAtendidasPorMes: Record<string, number>
  personasAtendidasEnElAnio: number
  citasPorEstado: Record<EstadoCitaPsicologica, number>
  tasaInasistencia: number
  distribucionPorMunicipio: Record<string, number>
  distribucionPorTipoCita: Record<TipoCitaPsicologica, number>
}
