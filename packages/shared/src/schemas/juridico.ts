import { z } from 'zod'
import {
  ESTADOS_PROCESO_JURIDICO,
  FILTROS_PROCESO_JURIDICO,
  TIPOS_PERSONAL_JURIDICO,
  TIPOS_PROCESO_JURIDICO,
} from '../catalogos/juridico.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** UUID de un `Personal` (área JURIDICO), o "" cuando el proceso todavía no tiene esa asignación. */
const idPersonalOpcionalSchema = z
  .string()
  .refine((valor) => valor === '' || z.uuid().safeParse(valor).success, 'Selección inválida')

export const tipoProcesoJuridicoSchema = z.enum(TIPOS_PROCESO_JURIDICO)
export const estadoProcesoJuridicoSchema = z.enum(ESTADOS_PROCESO_JURIDICO)
export const tipoPersonalJuridicoSchema = z.enum(TIPOS_PERSONAL_JURIDICO)
export const filtroProcesoJuridicoSchema = z.enum(FILTROS_PROCESO_JURIDICO)

export const crearProcesoJuridicoSchema = z.object({
  tipo: tipoProcesoJuridicoSchema,
  abogadaId: idPersonalOpcionalSchema,
  procuradoraId: idPersonalOpcionalSchema,
  fechaInicio: fechaCalendarioSchema,
})
export type CrearProcesoJuridicoInput = z.infer<typeof crearProcesoJuridicoSchema>

export const editarAsignacionProcesoSchema = z.object({
  abogadaId: idPersonalOpcionalSchema,
  procuradoraId: idPersonalOpcionalSchema,
})
export type EditarAsignacionProcesoInput = z.infer<typeof editarAsignacionProcesoSchema>

export const cerrarProcesoSchema = z.object({
  fechaCierre: fechaCalendarioSchema,
})
export type CerrarProcesoInput = z.infer<typeof cerrarProcesoSchema>

export const agregarNotaAvanceSchema = z.object({
  contenido: z.string().min(1, 'Requerido'),
})
export type AgregarNotaAvanceInput = z.infer<typeof agregarNotaAvanceSchema>

/** `motivo` es texto libre opcional — "" significa "no se indicó", mismo criterio que datosAgresor. */
export const registrarAbandonoSchema = z.object({
  fecha: fechaCalendarioSchema,
  motivo: z.string(),
})
export type RegistrarAbandonoInput = z.infer<typeof registrarAbandonoSchema>

/** Contrato de los campos de texto de `multipart/form-data` al subir un documento de proceso (el archivo viaja aparte, como binario). */
export const subirDocumentoProcesoSchema = z.object({
  nombreVisible: z.string().min(1, 'Requerido'),
})
export type SubirDocumentoProcesoInput = z.infer<typeof subirDocumentoProcesoSchema>

/** Query de `GET /juridico/procesos` — la vista global paginada de "en curso / finalizados". */
export const listarProcesosQuerySchema = z.object({
  estado: filtroProcesoJuridicoSchema,
  page: z.coerce.number().int().min(1).default(1),
})
export type ListarProcesosQuery = z.infer<typeof listarProcesosQuerySchema>

// ---- DTOs de respuesta (mismo criterio que ExpedienteResumenArea/ExpedienteDetalleArea:
// una sola forma consumida tanto por el backend al construir la respuesta como por el
// frontend al tipar lo que recibe). ----

export type TipoProcesoJuridico = z.infer<typeof tipoProcesoJuridicoSchema>
export type EstadoProcesoJuridico = z.infer<typeof estadoProcesoJuridicoSchema>
export type TipoPersonalJuridico = z.infer<typeof tipoPersonalJuridicoSchema>
export type FiltroProcesoJuridico = z.infer<typeof filtroProcesoJuridicoSchema>

export interface PersonalAsignado {
  id: string
  nombre: string
}

export interface AbandonoDto {
  fecha: string
  motivo: string | null
}

/** Fila de `GET /juridico/expedientes/:id/procesos` y forma base de un proceso individual. */
export interface ProcesoResumen {
  id: string
  expedienteId: string
  tipo: TipoProcesoJuridico
  estado: EstadoProcesoJuridico
  abogada: PersonalAsignado | null
  procuradora: PersonalAsignado | null
  fechaInicio: string
  fechaCierre: string | null
  abandono: AbandonoDto | null
}

export interface NotaAvanceDto {
  id: string
  contenido: string
  registradoPor: string
  createdAt: string
}

export interface DocumentoProcesoDto {
  id: string
  nombreVisible: string
  nombreArchivo: string
  tamanioBytes: number
  createdAt: string
}

/** Detalle de `GET /juridico/procesos/:id` — el proceso más sus notas y documentos. */
export interface ProcesoDetalle extends ProcesoResumen {
  notas: NotaAvanceDto[]
  documentos: DocumentoProcesoDto[]
}

/** Fila de la vista global "Procesos" (punto 9 del plan) — incluye datos mínimos para ubicar a la usuaria. */
export interface ProcesoGlobalResumen extends ProcesoResumen {
  expedienteNumero: string
  usuariaNombreCompleto: string
}

export interface ProcesosPaginados {
  items: ProcesoGlobalResumen[]
  page: number
  pageSize: number
  total: number
}
