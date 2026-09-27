import { z } from 'zod'
import { AREAS_ATENCION, TIPOS_REGISTRO } from '../catalogos/registroUsuaria.js'
import { areaAtencionSchema } from './registroUsuaria.js'
import type { AreaAtencion, TipoRegistro } from './registroUsuaria.js'
import { tipoDocumentoSchema } from './documentos.js'
import { booleanoQuerySchema } from './query.js'
import type { TipoDocumento } from './documentos.js'
import { ESTADOS_TS, PRIORIDADES_REFERIDO } from '../catalogos/trabajoSocial.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const estadoTsSchema = z.enum(ESTADOS_TS)
export type EstadoTs = z.infer<typeof estadoTsSchema>

export const prioridadReferidoSchema = z.enum(PRIORIDADES_REFERIDO)
export type PrioridadReferido = z.infer<typeof prioridadReferidoSchema>

/** `POST /trabajo-social/expedientes/:id/referidos` — abre el modal "Referir a un área". */
export const referirSchema = z.object({
  area: areaAtencionSchema,
  profesionalAsignadoId: z.uuid().optional(),
  prioridad: prioridadReferidoSchema,
  motivo: z.string(),
  visibilidad: z.object({
    datosCaso: z.boolean(),
    documentos: z.array(tipoDocumentoSchema),
  }),
})
export type ReferirInput = z.infer<typeof referirSchema>

/**
 * `PUT /trabajo-social/expedientes/:id/accesos/:area` — un switch de la matriz. Ambos campos
 * opcionales porque cada cambio en la UI guarda solo la celda que se tocó (actualización
 * optimista fila por fila, no el formulario completo). 400 en el backend si `area = JURIDICO`
 * o el área no ha sido referida.
 */
export const actualizarAccesoSchema = z.object({
  datosCaso: z.boolean().optional(),
  documentos: z.record(tipoDocumentoSchema, z.boolean()).optional(),
})
export type ActualizarAccesoInput = z.infer<typeof actualizarAccesoSchema>

/** `POST /trabajo-social/expedientes/:id/egreso` — solo válido para `INTERNA` sin egreso previo. */
export const registrarEgresoSchema = z.object({
  fechaEgreso: fechaCalendarioSchema,
})
export type RegistrarEgresoInput = z.infer<typeof registrarEgresoSchema>

/** `GET /trabajo-social/usuarias?estado=&q=&pagina=` — lista con filtro de estado y búsqueda. */
export const listarUsuariasQuerySchema = z.object({
  estado: estadoTsSchema.optional(),
  q: z.string().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
})
export type ListarUsuariasQuery = z.infer<typeof listarUsuariasQuerySchema>

/** Filtro de tipo de registro del reporte — agrega "TODOS" a `TIPOS_REGISTRO`. */
export const filtroTipoRegistroReporteSchema = z.enum(['TODOS', ...TIPOS_REGISTRO])
export type FiltroTipoRegistroReporte = z.infer<typeof filtroTipoRegistroReporteSchema>

/** `GET /trabajo-social/reportes/poblacion-beneficiada` — vista previa y agregados. */
export const reportePoblacionQuerySchema = z.object({
  desde: fechaCalendarioSchema,
  hasta: fechaCalendarioSchema,
  tipoRegistro: filtroTipoRegistroReporteSchema.default('TODOS'),
  incluirNinos: booleanoQuerySchema.default(true),
})
export type ReportePoblacionQuery = z.infer<typeof reportePoblacionQuerySchema>

// ---- DTOs de respuesta (mismo criterio que ProcesoResumen/ProcesoDetalle en juridico.ts:
// una sola forma consumida tanto por el backend al construir la respuesta como por el
// frontend al tipar lo que recibe). ----

/** Fila de la cola "Pendientes de referir" en la bandeja de Inicio. */
export interface FilaColaReferir {
  expedienteId: string
  usuariaId: string
  numeroExpediente: string
  nombreCompleto: string
  tipoRegistro: TipoRegistro
  createdAt: string
}

/** Fila de la cola "Documentos por subir". */
export interface FilaDocumentoPendiente {
  expedienteId: string
  usuariaId: string
  numeroExpediente: string
  nombreCompleto: string
  tiposFaltantes: TipoDocumento[]
}

/** Fila de la cola "En albergue". */
export interface FilaEnAlbergue {
  expedienteId: string
  usuariaId: string
  numeroExpediente: string
  nombreCompleto: string
  fechaIngresoAlbergue: string
  diasEnAlbergue: number
}

/** Fila de "Atendidas recientemente". */
export interface FilaAtendidaReciente {
  expedienteId: string
  usuariaId: string
  numeroExpediente: string
  nombreCompleto: string
  areas: AreaAtencion[]
  estado: EstadoTs
}

/** Ítem de "Novedades de las áreas" — un evento de `AuditLog` en lenguaje natural. */
export interface NovedadArea {
  area: AreaAtencion
  expedienteId: string
  usuariaId: string
  texto: string
  createdAt: string
}

export interface ResumenMesTs {
  usuariasRegistradas: number
  ninosRegistrados: number
  referencias: number
}

/** `GET /trabajo-social/bandeja` — todo lo que necesita la pantalla de Inicio en una sola llamada. */
export interface BandejaTs {
  pendientesReferir: FilaColaReferir[]
  documentosPendientes: FilaDocumentoPendiente[]
  enAlbergue: FilaEnAlbergue[]
  recientes: FilaAtendidaReciente[]
  novedades: NovedadArea[]
  resumenMes: ResumenMesTs
}

/** Una celda de la matriz: cómo se ve el switch y si el usuario puede tocarlo. */
export interface CeldaAcceso {
  visible: boolean
  bloqueado: boolean
  deshabilitado: boolean
}

/** Una fila de la matriz: "Datos de la usuaria e hijas/hijos" o un tipo de documento. */
export interface FilaMatrizAccesos {
  clave: 'DATOS_CASO' | TipoDocumento
  etiqueta: string
  celdas: Record<AreaAtencion, CeldaAcceso>
}

/** `GET /trabajo-social/expedientes/:id/accesos` — matriz ya calculada por el backend. */
export interface MatrizAccesos {
  filas: FilaMatrizAccesos[]
}

/** Una fila del Excel/vista previa de población beneficiada (usuaria o hija/hijo). */
export interface FilaPoblacionBeneficiada {
  numero: number
  fecha: string
  departamento: string
  municipio: string
  numeroCaso: string
  fechaNacimiento: string
  edad: number
  rangoEdad: string
  nombresApellidos: string
  dpi: string | null
  genero: string
  grupoEtnico: string
  ubicacionGeografica: string
  tipologia: string
  registro: TipoRegistro
  relacion: string
}

/** Fila de la Bitácora del expediente (lectura de `AuditLog`, solo lectura). */
export interface EventoBitacora {
  id: string
  fecha: string
  accion: string
  texto: string
  autor: string
}

/** Roles válidos como columna de la matriz de accesos — mismo orden que en el prototipo. */
export const AREAS_MATRIZ_ACCESOS = AREAS_ATENCION
