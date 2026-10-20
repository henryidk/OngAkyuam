import { z } from 'zod'
import {
  ACCIONES_AUDIENCIA,
  CARTERAS_JURIDICO,
  DESCRIPCION_AUDIENCIA_MAX,
  DIAS_MAXIMOS_HISTORIAL_AUDIENCIAS,
  ESTADOS_AUDIENCIA,
  ESTADOS_VISIBLES_AUDIENCIA,
  MOTIVO_AUDIENCIA_MAX,
  normalizarNumeroJudicial,
  NUMERO_JUDICIAL_MAX,
  OBSERVACIONES_AUDIENCIA_MAX,
  ORIGENES_CANCELACION_AUDIENCIA,
  RESULTADOS_AUDIENCIA,
  VISTAS_AUDIENCIAS,
} from '../catalogos/audienciasJuridico.js'
import { BUSQUEDA_MAX } from './juridico.js'
import type {
  DocumentoProcesoDto,
  PersonalAsignado,
  ProcesoVinculadoDto,
  TipoProcesoJuridico,
  UsuariaJuridicoRef,
} from './juridico.js'
import { fechaHoraLocalSchema } from './fechaHora.js'
import { booleanoQuerySchema, fechaReporteSchema } from './query.js'
import { diasEntreFechasGT } from '../timezone.js'

/** Contador de concurrencia optimista: el cliente devuelve la versión que leyó. */
const versionSchema = z.number().int().min(1)

export const estadoAudienciaSchema = z.enum(ESTADOS_AUDIENCIA)
export const estadoVisibleAudienciaSchema = z.enum(ESTADOS_VISIBLES_AUDIENCIA)
export const origenCancelacionAudienciaSchema = z.enum(ORIGENES_CANCELACION_AUDIENCIA)
export const resultadoAudienciaSchema = z.enum(RESULTADOS_AUDIENCIA)
export const carteraJuridicoSchema = z.enum(CARTERAS_JURIDICO)

export type EstadoAudiencia = z.infer<typeof estadoAudienciaSchema>
export type EstadoVisibleAudiencia = z.infer<typeof estadoVisibleAudienciaSchema>
export type OrigenCancelacionAudiencia = z.infer<typeof origenCancelacionAudienciaSchema>
export type ResultadoAudiencia = z.infer<typeof resultadoAudienciaSchema>
export type CarteraJuridico = z.infer<typeof carteraJuridicoSchema>
export type AccionAudiencia = (typeof ACCIONES_AUDIENCIA)[number]
export type VistaAudiencias = (typeof VISTAS_AUDIENCIAS)[number]

const motivoObligatorioSchema = z.string().trim().min(1, 'Escriba el motivo').max(MOTIVO_AUDIENCIA_MAX)
const observacionesSchema = z.string().trim().max(OBSERVACIONES_AUDIENCIA_MAX)

/** No. judicial ya normalizado (§4). Sin formato forzado: cada juzgado numera distinto. */
export const numeroJudicialSchema = z
  .string()
  .transform(normalizarNumeroJudicial)
  .pipe(z.string().min(1, 'Escriba el No. judicial').max(NUMERO_JUDICIAL_MAX, `Máximo ${NUMERO_JUDICIAL_MAX} caracteres`))

/**
 * No. judicial que se puede aprovechar a capturar al agendar o al registrar el resultado, si el
 * proceso todavía no lo tiene. "" o ausente = no se captura ahora.
 */
const numeroJudicialOpcionalSchema = z
  .string()
  .transform(normalizarNumeroJudicial)
  .pipe(z.string().max(NUMERO_JUDICIAL_MAX, `Máximo ${NUMERO_JUDICIAL_MAX} caracteres`))
  .transform((numero) => (numero === '' ? null : numero))
  .nullable()
  .default(null)

// ---- Escrituras ----

/**
 * `POST /juridico/procesos/:procesoId/audiencias`. Solo a futuro (lo valida el backend con su
 * reloj). Con `reprogramadaDesdeId` es "Agendar nueva fecha" de una cancelada o no realizada.
 */
export const agendarAudienciaSchema = z.object({
  fechaHora: fechaHoraLocalSchema,
  responsableId: z.uuid('Seleccione la responsable'),
  descripcion: z.string().trim().max(DESCRIPCION_AUDIENCIA_MAX).default(''),
  numeroJudicial: numeroJudicialOpcionalSchema,
  reprogramadaDesdeId: z.uuid().nullable().default(null),
})
export type AgendarAudienciaInput = z.infer<typeof agendarAudienciaSchema>

/** `POST /juridico/audiencias/:id/reprogramacion`: marca la actual REPROGRAMADA y crea la nueva. */
export const reprogramarAudienciaSchema = z.object({
  fechaHora: fechaHoraLocalSchema,
  responsableId: z.uuid('Seleccione la responsable'),
  motivo: motivoObligatorioSchema,
  version: versionSchema,
})
export type ReprogramarAudienciaInput = z.infer<typeof reprogramarAudienciaSchema>

/** `POST /juridico/audiencias/:id/cancelacion` (origen MANUAL). */
export const cancelarAudienciaSchema = z.object({
  motivo: motivoObligatorioSchema,
  version: versionSchema,
})
export type CancelarAudienciaInput = z.infer<typeof cancelarAudienciaSchema>

/** `PATCH /juridico/audiencias/:id/responsable`. */
export const cambiarResponsableAudienciaSchema = z.object({
  responsableId: z.uuid('Seleccione la responsable'),
  version: versionSchema,
})
export type CambiarResponsableAudienciaInput = z.infer<typeof cambiarResponsableAudienciaSchema>

/** `POST /juridico/audiencias/:id/resultado`. "No se realizó" exige motivo. */
export const registrarResultadoAudienciaSchema = z
  .object({
    resultado: resultadoAudienciaSchema,
    observaciones: observacionesSchema.default(''),
    motivo: z.string().trim().max(MOTIVO_AUDIENCIA_MAX).default(''),
    numeroJudicial: numeroJudicialOpcionalSchema,
    version: versionSchema,
  })
  .refine((datos) => datos.resultado !== 'NO_REALIZADA' || datos.motivo.length > 0, {
    path: ['motivo'],
    message: 'Escriba por qué no se realizó',
  })
export type RegistrarResultadoAudienciaInput = z.infer<typeof registrarResultadoAudienciaSchema>

/** `PATCH /juridico/audiencias/:id/observaciones`: completar lo ocurrido después del resultado. */
export const observacionesAudienciaSchema = z.object({
  observaciones: observacionesSchema,
  version: versionSchema,
})
export type ObservacionesAudienciaInput = z.infer<typeof observacionesAudienciaSchema>

/**
 * `PATCH /juridico/procesos/:id/numero-judicial`. Si otro proceso ya usa el número, el backend
 * responde 409 `NUMERO_JUDICIAL_REPETIDO` y el modal reenvía con `confirmarNumeroRepetido`.
 */
export const asignarNumeroJudicialSchema = z.object({
  numeroJudicial: numeroJudicialSchema,
  version: versionSchema,
  confirmarNumeroRepetido: z.boolean().default(false),
})
export type AsignarNumeroJudicialInput = z.infer<typeof asignarNumeroJudicialSchema>

// ---- Consultas ----

/**
 * `GET /juridico/audiencias`. El Historial exige Desde y Hasta (máximo un año); Próximas y
 * Pendientes no los necesitan.
 */
export const listarAudienciasQuerySchema = z
  .object({
    vista: z.enum(VISTAS_AUDIENCIAS).default('proximas'),
    q: z.string().trim().max(BUSQUEDA_MAX).optional(),
    responsableId: z.uuid().optional(),
    /** Solo las audiencias donde la cuenta actual es la responsable. */
    mias: booleanoQuerySchema.optional(),
    desde: fechaReporteSchema.optional(),
    hasta: fechaReporteSchema.optional(),
    estado: estadoAudienciaSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .superRefine((query, ctx) => {
    if (query.vista !== 'historial') return
    if (!query.desde || !query.hasta) {
      ctx.addIssue({ code: 'custom', path: ['desde'], message: 'Elija el rango de fechas' })
      return
    }
    const dias = diasEntreFechasGT(query.desde, query.hasta)
    if (dias < 0) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final es anterior a la inicial' })
    } else if (dias > DIAS_MAXIMOS_HISTORIAL_AUDIENCIAS) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'El rango puede ser de hasta un año' })
    }
  })
export type ListarAudienciasQuery = z.infer<typeof listarAudienciasQuerySchema>

/** `GET /juridico/audiencias/disponibilidad`: lo que ya tiene esa abogada ese día. */
export const disponibilidadAudienciasQuerySchema = z.object({
  responsableId: z.uuid(),
  fecha: fechaReporteSchema,
})
export type DisponibilidadAudienciasQuery = z.infer<typeof disponibilidadAudienciasQuerySchema>

// ---- DTOs de respuesta ----

/** Otra audiencia de la cadena de reprogramación ("Reprogramada → 04/11/2026 09:00"). */
export interface AudienciaEnlazadaDto {
  id: string
  fecha: string
  hora: string
}

/**
 * Fila de la sección Audiencias. `fecha` ("YYYY-MM-DD") y `hora` ("HH:mm") ya vienen en hora de
 * Guatemala desde el servidor: ninguna pantalla depende de la zona de la computadora (§5).
 */
export interface AudienciaFilaDto {
  id: string
  procesoId: string
  /** No. interno del proceso (`etiquetaProceso`). */
  codigoProceso: string
  expedienteNumero: string
  tipoProceso: TipoProcesoJuridico
  usuaria: UsuariaJuridicoRef
  numeroJudicial: string | null
  /** Instante ISO (UTC). */
  inicio: string
  fecha: string
  hora: string
  responsable: PersonalAsignado
  estado: EstadoAudiencia
  estadoVisible: EstadoVisibleAudiencia
  descripcion: string | null
  origenCancelacion: OrigenCancelacionAudiencia | null
  accionesDisponibles: AccionAudiencia[]
  version: number
}

/** Audiencia completa: pestaña Audiencias del proceso y vista de la audiencia. */
export interface AudienciaDetalleDto extends AudienciaFilaDto {
  observaciones: string | null
  motivo: string | null
  reprogramadaDesde: AudienciaEnlazadaDto | null
  reprogramadaA: AudienciaEnlazadaDto | null
  resultadoEn: string | null
  documentos: DocumentoProcesoDto[]
}

export interface AudienciasPaginadas {
  items: AudienciaFilaDto[]
  page: number
  pageSize: number
  total: number
}

/** Una audiencia ya agendada de la abogada ese día ("09:00 · 03-2026 · Conciliación"). */
export interface AudienciaOcupadaDto {
  id: string
  hora: string
  codigoProceso: string
  descripcion: string | null
}

/** `GET /juridico/audiencias/disponibilidad`. */
export interface DisponibilidadAudienciasDto {
  fecha: string
  responsableId: string
  audiencias: AudienciaOcupadaDto[]
}

/** Respuesta de agendar o reprogramar: lo justo para el toast y para refrescar la vista. */
export interface AudienciaAgendadaDto {
  id: string
  fecha: string
  hora: string
}

/**
 * Columna "Próxima audiencia" de Procesos: la PROGRAMADA más cercana o, si hay, la más antigua
 * pendiente de resultado, porque es la que exige acción (§7.5).
 */
export interface ProximaAudienciaDto {
  id: string
  inicio: string
  fecha: string
  hora: string
  estadoVisible: Extract<EstadoVisibleAudiencia, 'PROXIMA' | 'HOY' | 'PENDIENTE_RESULTADO'>
}

/** Cuerpo del 409 de No. judicial repetido: el modal lo muestra y reenvía con la confirmación. */
export interface ErrorNumeroJudicialRepetido {
  codigo: 'NUMERO_JUDICIAL_REPETIDO'
  message: string
  detalle: { procesos: ProcesoVinculadoDto[] }
}
