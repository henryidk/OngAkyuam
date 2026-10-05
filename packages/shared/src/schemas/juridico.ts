import { z } from 'zod'
import {
  ACCIONES_PROCESO,
  ESTADOS_VISIBLES_PROCESO,
  FASES_PROCESO_JURIDICO,
  FORMAS_FINALIZACION_PROCESO,
  LARGO_MAXIMO_TIPO_ACTUACION,
  MAX_PROCESOS_POR_LOTE,
  MOTIVOS_ABANDONO_PROCESO,
  normalizarTipoActuacion,
  PROCESOS_PAGE_SIZE_MAXIMO,
  SITUACIONES_PROCESO_JURIDICO,
  TIPOS_PERSONAL_JURIDICO,
  TIPOS_PROCESO_JURIDICO,
} from '../catalogos/juridico.js'
import type { GRUPOS_ETNICOS } from '../catalogos/registroUsuaria.js'
import type { TipoRegistro } from './registroUsuaria.js'
import { booleanoQuerySchema } from './query.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** UUID de un `Personal` (área JURIDICO), o "" cuando el proceso todavía no tiene esa asignación. */
const idPersonalOpcionalSchema = z
  .string()
  .refine((valor) => valor === '' || z.uuid().safeParse(valor).success, 'Selección inválida')

/** Contador de concurrencia optimista: el cliente devuelve la versión que leyó (§4.4 del plan). */
const versionSchema = z.number().int().min(1)

export const tipoProcesoJuridicoSchema = z.enum(TIPOS_PROCESO_JURIDICO)
export const tipoPersonalJuridicoSchema = z.enum(TIPOS_PERSONAL_JURIDICO)
export const faseProcesoJuridicoSchema = z.enum(FASES_PROCESO_JURIDICO)
export const situacionProcesoJuridicoSchema = z.enum(SITUACIONES_PROCESO_JURIDICO)
export const estadoVisibleProcesoSchema = z.enum(ESTADOS_VISIBLES_PROCESO)
export const formaFinalizacionProcesoSchema = z.enum(FORMAS_FINALIZACION_PROCESO)
export const motivoAbandonoProcesoSchema = z.enum(MOTIVOS_ABANDONO_PROCESO)

export type TipoProcesoJuridico = z.infer<typeof tipoProcesoJuridicoSchema>
export type TipoPersonalJuridico = z.infer<typeof tipoPersonalJuridicoSchema>
export type FaseProcesoJuridico = z.infer<typeof faseProcesoJuridicoSchema>
export type SituacionProcesoJuridico = z.infer<typeof situacionProcesoJuridicoSchema>
export type EstadoVisibleProceso = z.infer<typeof estadoVisibleProcesoSchema>
export type FormaFinalizacionProceso = z.infer<typeof formaFinalizacionProcesoSchema>
export type MotivoAbandonoProceso = z.infer<typeof motivoAbandonoProcesoSchema>
export type AccionProceso = (typeof ACCIONES_PROCESO)[number]

// ---- Registro en lote (asistente de 2 pasos) ----

export const CONTRAPARTE_MAX = 160

export const procesoEnLoteSchema = z.object({
  tipo: tipoProcesoJuridicoSchema,
  abogadaId: idPersonalOpcionalSchema,
  procuradoraId: idPersonalOpcionalSchema,
  // Sin contraparte: al registrar no se pide; se completa después en "Datos del proceso".
  fechaInicio: fechaCalendarioSchema,
  procesoOrigenId: z.uuid().nullable().default(null),
})
export type ProcesoEnLoteInput = z.infer<typeof procesoEnLoteSchema>

/** `POST /juridico/expedientes/:id/procesos/lote`. */
export const crearProcesosEnLoteSchema = z.object({
  // null = se registra desde la ficha de la usuaria, sin una referencia pendiente que atender.
  referidoId: z.uuid().nullable(),
  procesos: z
    .array(procesoEnLoteSchema)
    .min(1, 'Seleccione al menos un proceso')
    .max(MAX_PROCESOS_POR_LOTE)
    .refine(
      (procesos) => new Set(procesos.map((proceso) => proceso.tipo)).size === procesos.length,
      'Tipo repetido en el lote',
    ),
  confirmaDuplicados: z.boolean().default(false),
})
export type CrearProcesosEnLoteInput = z.infer<typeof crearProcesosEnLoteSchema>

// ---- Datos y transiciones de un proceso ----

/** `PATCH /juridico/procesos/:id/datos`. */
export const editarDatosProcesoSchema = z.object({
  numeroJudicial: z.string().trim().max(60),
  organoJudicial: z.string().trim().max(160),
  contraparte: z.string().trim().max(CONTRAPARTE_MAX),
  abogadaId: idPersonalOpcionalSchema,
  procuradoraId: idPersonalOpcionalSchema,
  version: versionSchema,
})
export type EditarDatosProcesoInput = z.infer<typeof editarDatosProcesoSchema>

/** Body de las transiciones que no piden más datos: avance y reactivación. */
export const transicionSimpleSchema = z.object({ version: versionSchema })
export type TransicionSimpleInput = z.infer<typeof transicionSimpleSchema>

export const DETALLE_FINALIZACION_MAX = 300

export const finalizarProcesoSchema = z
  .object({
    forma: formaFinalizacionProcesoSchema,
    detalle: z.string().trim().max(DETALLE_FINALIZACION_MAX),
    fechaCierre: fechaCalendarioSchema,
    version: versionSchema,
  })
  .refine((datos) => datos.forma !== 'OTROS' || datos.detalle.length > 0, {
    path: ['detalle'],
    message: 'Especifique la forma de finalización',
  })
export type FinalizarProcesoInput = z.infer<typeof finalizarProcesoSchema>

export const MOTIVO_SUSPENSION_MAX = 300

export const suspenderProcesoSchema = z.object({
  motivo: z.string().trim().min(1, 'Requerido').max(MOTIVO_SUSPENSION_MAX),
  version: versionSchema,
})
export type SuspenderProcesoInput = z.infer<typeof suspenderProcesoSchema>

export const OBSERVACIONES_ABANDONO_MAX = 500
export const INTENTOS_CONTACTO_MAX = 100

export const registrarAbandonoSchema = z.object({
  motivoCatalogo: motivoAbandonoProcesoSchema,
  observaciones: z.string().trim().max(OBSERVACIONES_ABANDONO_MAX),
  // "" = no se sabe cuándo fue el último contacto.
  ultimoContacto: z.union([fechaCalendarioSchema, z.literal('')]),
  intentos: z.number().int().min(0).max(INTENTOS_CONTACTO_MAX),
  notificarTs: z.boolean(),
  version: versionSchema,
})
export type RegistrarAbandonoInput = z.infer<typeof registrarAbandonoSchema>

// ---- Bitácora ----

export const CONTENIDO_BITACORA_MAX = 4000

/**
 * `POST /juridico/procesos/:id/bitacora`. El tipo es texto libre; aunque alguien escriba "Sistema",
 * la entrada se guarda como actuación normal: solo el backend crea entradas de sistema.
 */
export const registrarActuacionSchema = z.object({
  tipo: z
    .string()
    .transform(normalizarTipoActuacion)
    .pipe(
      z
        .string()
        .min(1, 'Escriba el tipo de actuación')
        .max(LARGO_MAXIMO_TIPO_ACTUACION, `Máximo ${LARGO_MAXIMO_TIPO_ACTUACION} caracteres`),
    ),
  contenido: z.string().trim().min(1, 'Describa la actuación').max(CONTENIDO_BITACORA_MAX),
})
export type RegistrarActuacionInput = z.infer<typeof registrarActuacionSchema>

// ---- Carpetas y documentos ----

export const NOMBRE_CARPETA_MAX = 80
export const NOMBRE_DOCUMENTO_MAX = 120

export const nombreCarpetaSchema = z.object({
  nombre: z.string().trim().min(1, 'Requerido').max(NOMBRE_CARPETA_MAX),
})
export type NombreCarpetaInput = z.infer<typeof nombreCarpetaSchema>

export const renombrarDocumentoProcesoSchema = z.object({
  nombreVisible: z.string().trim().min(1, 'Requerido').max(NOMBRE_DOCUMENTO_MAX),
})
export type RenombrarDocumentoProcesoInput = z.infer<typeof renombrarDocumentoProcesoSchema>

export const MODOS_URL_DOCUMENTO = ['descarga', 'vista'] as const
export const urlDocumentoProcesoQuerySchema = z.object({
  modo: z.enum(MODOS_URL_DOCUMENTO).default('descarga'),
})
export type UrlDocumentoProcesoQuery = z.infer<typeof urlDocumentoProcesoQuerySchema>

// ---- Listado ----

export const BUSQUEDA_MAX = 80
/** La lista de Procesos busca desde 3 caracteres, igual que la de Usuarias. */
export const LARGO_MINIMO_BUSQUEDA_PROCESOS = 3

/**
 * Query de `GET /juridico/procesos`: la lista de trabajo, siempre solo procesos en trámite.
 * Los suspendidos, finalizados y abandonados se consultan en la ficha de cada usuaria.
 */
export const listarProcesosQuerySchema = z.object({
  q: z.string().trim().max(BUSQUEDA_MAX).optional(),
  /** Solo los procesos donde la cuenta actual es la abogada o la procuradora asignada. */
  mios: booleanoQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PROCESOS_PAGE_SIZE_MAXIMO).default(20),
})
export type ListarProcesosQuery = z.infer<typeof listarProcesosQuerySchema>

// ---- Área de atención (bandeja de referencias) ----

export const VISTAS_BANDEJA_JURIDICO = ['pendientes', 'devueltas'] as const
export const bandejaJuridicoQuerySchema = z.object({
  vista: z.enum(VISTAS_BANDEJA_JURIDICO).default('pendientes'),
})
export type BandejaJuridicoQuery = z.infer<typeof bandejaJuridicoQuerySchema>
export type VistaBandejaJuridico = BandejaJuridicoQuery['vista']

export const MOTIVO_DEVOLUCION_MAX = 500

export const devolverReferenciaSchema = z.object({
  motivo: z.string().trim().min(1, 'Requerido').max(MOTIVO_DEVOLUCION_MAX),
})
export type DevolverReferenciaInput = z.infer<typeof devolverReferenciaSchema>

// ---- Usuarias (lista y ficha) ----

export const FILTROS_USUARIAS_JURIDICO = ['REFERENCIA_NUEVA', 'CON_ACTIVOS', 'SIN_ACTIVOS'] as const
export type FiltroUsuariasJuridico = (typeof FILTROS_USUARIAS_JURIDICO)[number]

export const ETIQUETAS_FILTRO_USUARIAS_JURIDICO: Record<FiltroUsuariasJuridico, string> = {
  REFERENCIA_NUEVA: 'Referencia nueva',
  CON_ACTIVOS: 'Con procesos activos',
  SIN_ACTIVOS: 'Sin procesos activos',
}

/** Igual que la lista de Trabajo Social: un nombre necesita 3 letras; DPI y expediente van completos. */
export const LARGO_MINIMO_BUSQUEDA_USUARIAS = 3

export const listarUsuariasJuridicoQuerySchema = z.object({
  filtro: z.enum(FILTROS_USUARIAS_JURIDICO).optional(),
  q: z.string().trim().max(BUSQUEDA_MAX).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
})
export type ListarUsuariasJuridicoQuery = z.infer<typeof listarUsuariasJuridicoQuerySchema>

// ---- DTOs de respuesta (mismo criterio que ExpedienteResumenArea/ExpedienteDetalleArea:
// una sola forma consumida tanto por el backend al construir la respuesta como por el
// frontend al tipar lo que recibe). ----

export interface PersonalAsignado {
  id: string
  nombre: string
}

export interface UsuariaJuridicoRef {
  id: string
  nombreCompleto: string
}

export interface ProcesoResumen {
  id: string
  /** "J2-05-2026": consecutivo del proceso dentro del expediente + número de expediente. */
  codigo: string
  expedienteId: string
  expedienteNumero: string
  usuaria: UsuariaJuridicoRef
  tipo: TipoProcesoJuridico
  fase: FaseProcesoJuridico
  situacion: SituacionProcesoJuridico
  estadoVisible: EstadoVisibleProceso
  formaFinalizacion: FormaFinalizacionProceso | null
  detalleFinalizacion: string | null
  numeroJudicial: string | null
  abogada: PersonalAsignado | null
  procuradora: PersonalAsignado | null
  fechaInicio: string
  fechaCierre: string | null
  ultimaActuacionEn: string
  requiereAtencion: boolean
  version: number
}

export interface AbandonoDto {
  fecha: string
  motivoCatalogo: MotivoAbandonoProceso
  observaciones: string | null
  ultimoContacto: string | null
  intentosContacto: number
  notificadoATs: boolean
}

export interface SuspensionDto {
  motivo: string
  desde: string
}

export interface EntradaBitacoraDto {
  id: string
  /** Texto libre tal como se escribió (o `TIPO_ENTRADA_SISTEMA` en los eventos del sistema). */
  tipo: string
  esSistema: boolean
  contenido: string
  registradoPor: string
  createdAt: string
}

export interface DocumentoProcesoDto {
  id: string
  carpetaId: string
  nombreVisible: string
  nombreArchivo: string
  mimeType: string
  tamanioBytes: number
  subidoPor: string
  createdAt: string
}

export interface CarpetaDto {
  id: string
  nombre: string
  documentos: DocumentoProcesoDto[]
}

export interface ProcesoVinculadoDto {
  id: string
  codigo: string
  tipo: TipoProcesoJuridico
}

/** Detalle de `GET /juridico/procesos/:id`. */
export interface ProcesoDetalle extends ProcesoResumen {
  organoJudicial: string | null
  contraparte: string | null
  procesoOrigen: ProcesoVinculadoDto | null
  abandonoVigente: AbandonoDto | null
  suspensionVigente: SuspensionDto | null
  /** Lo que la máquina de estados permite ahora: el frontend no reimplementa las reglas. */
  accionesDisponibles: AccionProceso[]
  /** Las más recientes primero. */
  bitacora: EntradaBitacoraDto[]
  carpetas: CarpetaDto[]
  otrosProcesosUsuaria: ProcesoResumen[]
}

export interface ProcesosPaginados {
  items: ProcesoResumen[]
  page: number
  pageSize: number
  total: number
}

/** `GET /juridico/procesos/resumen` — tarjetas de la lista e insignias de la barra lateral. */
export interface ResumenProcesos {
  referenciasPendientes: number
  procesosSugeridos: number
  total: number
  enTramite: number
  suspendidos: number
  finalizados: number
  finalizadosPorForma: Record<FormaFinalizacionProceso, number>
  abandonados: number
  requierenAtencion: number
}

export interface UsuariaReferidaDto extends UsuariaJuridicoRef {
  dpi: string | null
}

/** Tarjeta del Área de atención. */
export interface ReferenciaBandejaDto {
  referidoId: string
  expedienteId: string
  expedienteNumero: string
  usuaria: UsuariaReferidaDto
  motivo: string | null
  referidoEn: string
  referidoPor: string
  procesosSugeridos: TipoProcesoJuridico[]
  devueltoEn: string | null
  motivoDevolucion: string | null
  /** Años cumplidos, en hora de Guatemala. */
  edad: number
  /** Nombre del municipio (o el escrito a mano si es de fuera de Alta Verapaz). */
  municipio: string | null
  /** Ya tiene procesos en Jurídico, de cualquier estado: la usuaria regresa. */
  atendidaAntes: boolean
  /** Procesos sin finalizar ni abandonar: marcan los sugeridos que ya están activos. */
  activosPorTipo: ProcesoActivoPorTipo[]
}

export interface ProcesoActivoPorTipo {
  tipo: TipoProcesoJuridico
  codigo: string
}

/** `GET /juridico/expedientes/:id/registro-contexto` — todo lo que necesita el asistente al abrir. */
export interface RegistroContextoDto {
  expediente: { id: string; numero: string }
  usuaria: UsuariaReferidaDto
  /** La referencia de Trabajo Social si sigue pendiente; `null` si ya se atendió o se devolvió. */
  referencia: ReferenciaBandejaDto | null
  sugeridos: TipoProcesoJuridico[]
  /** Procesos sin finalizar de la usuaria: alimentan el aviso "Ya tiene uno activo". */
  activosPorTipo: ProcesoActivoPorTipo[]
  procesosVinculables: ProcesoVinculadoDto[]
  historial: ProcesoResumen[]
}

export interface ProcesoCreadoDto {
  id: string
  codigo: string
}

export interface ProcesosCreadosLote {
  procesos: ProcesoCreadoDto[]
  usuariaId: string
}

/** Cuerpo del 409 de duplicados: el asistente lo muestra y reenvía con `confirmaDuplicados`. */
export interface ErrorDuplicadosLote {
  codigo: 'DUPLICADOS_ACTIVOS'
  message: string
  detalle: { duplicados: ProcesoActivoPorTipo[] }
}

/**
 * Columna "Procesos" de la lista de Usuarias: `EN_PROCESO` si tiene alguno en trámite o
 * suspendido, `FINALIZADO` si todos están cerrados (finalizados o abandonados), `null` sin procesos.
 */
export type EstadoProcesosUsuaria = 'EN_PROCESO' | 'FINALIZADO'

/** Fila de `GET /juridico/usuarias`: la usuaria y su expediente más reciente referido a Jurídico. */
export interface FilaUsuariaJuridico {
  usuariaId: string
  nombreCompleto: string
  dpi: string | null
  edad: number
  expedienteNumero: string
  estadoProcesos: EstadoProcesosUsuaria | null
  /** Abogadas de los procesos activos, sin repetir. */
  abogadas: string[]
  referenciaPendiente: boolean
  ultimaActividadEn: string
}

/** `GET /juridico/usuarias` — página de filas + contador de cada chip (con la búsqueda aplicada). */
export interface ListaUsuariasJuridico {
  filas: FilaUsuariaJuridico[]
  pagina: number
  porPagina: number
  /** Total del filtro activo, para la paginación. */
  total: number
  contadores: { TODAS: number } & Record<FiltroUsuariasJuridico, number>
}

/** "En proceso" = en trámite o suspendidos; "Cerrados" = finalizados o abandonados. */
export interface ContadoresUsuariaJuridico {
  enProceso: number
  cerrados: number
}

export const ESTADOS_REFERENCIA_JURIDICO = ['PENDIENTE', 'ATENDIDA', 'DEVUELTA'] as const
export type EstadoReferenciaJuridico = (typeof ESTADOS_REFERENCIA_JURIDICO)[number]

export interface ReferenciaHistorialDto {
  referidoId: string
  expedienteId: string
  expedienteNumero: string
  referidoEn: string
  referidoPor: string
  motivo: string | null
  procesosSugeridos: TipoProcesoJuridico[]
  estado: EstadoReferenciaJuridico
  motivoDevolucion: string | null
}

/** `GET /juridico/usuarias/:id` — encabezado de la ficha y todo lo que Jurídico lleva de la usuaria. */
export interface FichaUsuariaJuridicoDto {
  usuaria: UsuariaReferidaDto & {
    edad: number
    grupoEtnico: (typeof GRUPOS_ETNICOS)[number]
    municipio: string | null
  }
  /**
   * El expediente más reciente referido a Jurídico: de él salen los datos y documentos de
   * Trabajo Social y en él se abre un proceso nuevo cuando no hay referencia pendiente.
   */
  expediente: { id: string; numero: string; tipoRegistro: TipoRegistro; enAlbergue: boolean }
  contadores: ContadoresUsuariaJuridico
  procesos: ProcesoResumen[]
  /** Más reciente primero. */
  referencias: ReferenciaHistorialDto[]
}
