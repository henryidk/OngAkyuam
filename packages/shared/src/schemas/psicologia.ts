import { z } from 'zod'
import {
  ESTADOS_ATENCION_PSICOLOGICA,
  ESTADOS_CITA_PSICOLOGICA,
  MODALIDADES_CITA,
} from '../catalogos/psicologia.js'
import type { TipoDocumento } from './documentos.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** Valor crudo de un `<input type="datetime-local">` — se interpreta como hora de Guatemala vía `parseLocalGT`, nunca como UTC directo. */
const fechaHoraLocalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha y hora inválidas')

export const modalidadCitaSchema = z.enum(MODALIDADES_CITA)
export const estadoCitaPsicologicaSchema = z.enum(ESTADOS_CITA_PSICOLOGICA)
export const estadoAtencionPsicologicaSchema = z.enum(ESTADOS_ATENCION_PSICOLOGICA)

export const programarCitaSchema = z.object({
  fechaHora: fechaHoraLocalSchema,
  modalidad: modalidadCitaSchema,
  lugar: z.string(),
  motivo: z.string().min(1, 'Requerido'),
})
export type ProgramarCitaInput = z.infer<typeof programarCitaSchema>

/** PATCH al atender/cancelar una cita — `observaciones`/`acuerdos` son texto libre opcional ("" = sin dato, mismo criterio que datosAgresor). */
export const actualizarCitaSchema = z.object({
  estado: estadoCitaPsicologicaSchema,
  observaciones: z.string(),
  acuerdos: z.string(),
})
export type ActualizarCitaInput = z.infer<typeof actualizarCitaSchema>

export const actualizarEstadoAtencionSchema = z.object({
  estado: estadoAtencionPsicologicaSchema,
})
export type ActualizarEstadoAtencionInput = z.infer<typeof actualizarEstadoAtencionSchema>

/** Query compartido por `GET /psicologia/agenda` y `GET /psicologia/reporte`. */
export const rangoFechasQuerySchema = z.object({
  desde: fechaCalendarioSchema,
  hasta: fechaCalendarioSchema,
})
export type RangoFechasQuery = z.infer<typeof rangoFechasQuerySchema>

// ---- DTOs de respuesta (misma forma consumida por backend y frontend) ----

export type ModalidadCita = z.infer<typeof modalidadCitaSchema>
export type EstadoCitaPsicologica = z.infer<typeof estadoCitaPsicologicaSchema>
export type EstadoAtencionPsicologica = z.infer<typeof estadoAtencionPsicologicaSchema>

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
  estado: EstadoCitaPsicologica
  observaciones: string | null
  acuerdos: string | null
  atendidoPor: string
  documento: DocumentoCitaDto | null
}

export interface AtencionPsicologicaDetalle {
  id: string
  expedienteId: string
  estado: EstadoAtencionPsicologica
  actualizadoPor: string
  actualizadoEn: string
  citas: CitaResumen[]
}

/** Fila de `GET /psicologia/agenda` — incluye datos mínimos para ubicar a la usuaria sin abrir el expediente. */
export interface AgendaCita extends CitaResumen {
  expedienteId: string
  usuariaNombreCompleto: string
}

export interface ReportePsicologia {
  desde: string
  hasta: string
  totalCitas: number
  porEstado: Record<EstadoCitaPsicologica, number>
  porModalidad: Record<ModalidadCita, number>
  usuariasAtendidas: number
}
