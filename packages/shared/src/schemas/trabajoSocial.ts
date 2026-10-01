import { z } from 'zod'
import { AREAS_ATENCION, TIPOS_REGISTRO } from '../catalogos/registroUsuaria.js'
import { areaAtencionSchema } from './registroUsuaria.js'
import type { AreaAtencion, TipoRegistro } from './registroUsuaria.js'
import { tipoDocumentoTrabajoSocialSchema } from './documentos.js'
import { booleanoQuerySchema } from './query.js'
import { hoyGT } from '../timezone.js'
import type { TipoDocumento, TipoDocumentoTrabajoSocial } from './documentos.js'
import { ESTADOS_AREA, ESTADOS_TS, FILTROS_LISTA_USUARIAS, PRIORIDADES_REFERIDO } from '../catalogos/trabajoSocial.js'
import { TIPOS_PROCESO_JURIDICO } from '../catalogos/juridico.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const estadoTsSchema = z.enum(ESTADOS_TS)
export type EstadoTs = z.infer<typeof estadoTsSchema>

export const estadoAreaSchema = z.enum(ESTADOS_AREA)
export type EstadoArea = z.infer<typeof estadoAreaSchema>

export const filtroListaUsuariasSchema = z.enum(FILTROS_LISTA_USUARIAS)
export type FiltroListaUsuarias = z.infer<typeof filtroListaUsuariasSchema>

export const prioridadReferidoSchema = z.enum(PRIORIDADES_REFERIDO)
export type PrioridadReferido = z.infer<typeof prioridadReferidoSchema>

/** `POST /trabajo-social/expedientes/:id/referidos` — abre el modal "Referir a un área". */
export const MOTIVO_REFERIDO_MAX = 1000

export const referirSchema = z.object({
  area: areaAtencionSchema,
  // Opcional en el contrato: sin profesional, el referido queda en la cola del área (flujo de
  // reclamación de Psicología intacto). El modal lo exige para Psicología.
  profesionalAsignadoId: z.uuid().optional(),
  prioridad: prioridadReferidoSchema,
  motivo: z.string().trim().max(MOTIVO_REFERIDO_MAX),
  // Solo aplica al referir a Jurídico: qué procesos cree Trabajo Social que hacen falta. Es una
  // sugerencia — Jurídico decide cuáles registra.
  procesosSugeridos: z
    .array(z.enum(TIPOS_PROCESO_JURIDICO))
    .max(TIPOS_PROCESO_JURIDICO.length)
    .refine((tipos) => new Set(tipos).size === tipos.length, 'Proceso sugerido repetido')
    .default([]),
  visibilidad: z.object({
    datosCaso: z.boolean(),
    // Solo los formularios de Trabajo Social son restringibles por área.
    documentos: z.array(tipoDocumentoTrabajoSocialSchema),
  }),
})
export type ReferirInput = z.infer<typeof referirSchema>

/**
 * `PUT /trabajo-social/expedientes/:id/accesos/:area` — un switch de la matriz. Ambos campos
 * opcionales porque cada cambio en la UI guarda solo la celda que se tocó (actualización
 * optimista fila por fila, no el formulario completo). 400 en el backend si `area = JURIDICO`
 * o el área no ha sido referida.
 */
export const actualizarAccesoSchema = z
  .object({
    datosCaso: z.boolean().optional(),
    // `partialRecord`: en Zod v4 un `z.record` con clave enum exige todas las claves.
    documentos: z.partialRecord(tipoDocumentoTrabajoSocialSchema, z.boolean()).optional(),
  })
  .refine(
    (datos) => datos.datosCaso !== undefined || Object.keys(datos.documentos ?? {}).length > 0,
    { message: 'Debe indicar al menos un acceso a modificar' },
  )
export type ActualizarAccesoInput = z.infer<typeof actualizarAccesoSchema>

/**
 * `POST /trabajo-social/expedientes/:id/egreso` — solo válido para `INTERNA` sin egreso previo.
 * Que no sea anterior al ingreso lo valida el backend, que es quien conoce esa fecha.
 */
export const registrarEgresoSchema = z.object({
  // Comparación de strings "YYYY-MM-DD": ordenan igual que las fechas, sin pasar por `Date`.
  fechaEgreso: fechaCalendarioSchema.refine((fecha) => fecha <= hoyGT(), {
    message: 'La fecha de egreso no puede ser futura',
  }),
})
export type RegistrarEgresoInput = z.infer<typeof registrarEgresoSchema>

export interface EgresoRegistrado {
  expedienteId: string
  fechaEgreso: string
}

/** Largo máximo del término de búsqueda de la lista — evita consultas trigram absurdamente largas. */
export const BUSQUEDA_USUARIAS_MAX = 100

/**
 * `GET /trabajo-social/usuarias?estado=&q=&pagina=` — lista con filtro y búsqueda. Sin `estado` =
 * "Todas". `q` busca por nombre (trigram), DPI exacto o número de expediente `NN-AAAA`.
 */
export const listarUsuariasQuerySchema = z.object({
  estado: filtroListaUsuariasSchema.optional(),
  q: z.string().trim().max(BUSQUEDA_USUARIAS_MAX).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
})
export type ListarUsuariasQuery = z.infer<typeof listarUsuariasQuerySchema>

/** Una fila de la lista de Usuarias: la usuaria y su caso activo (el más reciente). */
export interface FilaListaUsuarias {
  usuariaId: string
  nombreCompleto: string
  fechaNacimiento: string
  expedienteId: string
  numeroExpediente: string
  tipoRegistro: TipoRegistro
  enAlbergue: boolean
  cantidadNinos: number
  areasReferidas: AreaAtencion[]
  estado: EstadoTs
  /** Instante del último movimiento del caso activo (registro o referido). */
  ultimaActividadEn: string
  /** Área del último referido, o `null` si lo último fue el registro del caso. */
  ultimaActividadArea: AreaAtencion | null
}

/** `GET /trabajo-social/usuarias` — página de filas + contadores de cada chip (con la búsqueda aplicada). */
export interface ListaUsuariasTs {
  filas: FilaListaUsuarias[]
  pagina: number
  porPagina: number
  /** Total del filtro activo — para la paginación. */
  total: number
  contadores: { TODAS: number } & Record<FiltroListaUsuarias, number>
}

/** Cómo va un área referida con el caso — tarjeta "Áreas que la atienden" de la ficha. */
export interface EstadoAreaCaso {
  area: AreaAtencion
  estado: EstadoArea
  /** Próxima acción o situación del área, ya en lenguaje natural (p. ej. "Próxima cita 02/10/2026 09:00"). */
  detalle: string
  profesional: string | null
  prioridad: PrioridadReferido
  referidoEn: string
}

/** Estado derivado de un caso: el de Trabajo Social y el de cada área referida. */
export interface EstadoCasoTs {
  estado: EstadoTs
  areas: EstadoAreaCaso[]
}

/** Filtro de tipo de registro del reporte — agrega "TODOS" a `TIPOS_REGISTRO`. */
export const filtroTipoRegistroReporteSchema = z.enum(['TODOS', ...TIPOS_REGISTRO])
export type FiltroTipoRegistroReporte = z.infer<typeof filtroTipoRegistroReporteSchema>

/**
 * El regex solo mira la forma: "2026-02-31" pasaría y Postgres fallaría al convertirla a `date`.
 * Aquí se comprueba que el día exista; `Date.UTC` se usa solo para ese cálculo (desborda al
 * mes siguiente si el día no existe), nunca para guardar ni mostrar la fecha.
 */
function esFechaCalendarioReal(iso: string): boolean {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

const fechaReporteSchema = fechaCalendarioSchema.refine(esFechaCalendarioReal, 'Fecha inválida')

/** `GET /trabajo-social/reportes/poblacion-beneficiada` (vista previa y agregados) y su `.xlsx`. */
export const reportePoblacionQuerySchema = z
  .object({
    desde: fechaReporteSchema,
    hasta: fechaReporteSchema,
    tipoRegistro: filtroTipoRegistroReporteSchema.default('TODOS'),
    incluirNinos: booleanoQuerySchema.default(true),
  })
  // "YYYY-MM-DD" se ordena igual como texto que como fecha.
  .refine((query) => query.desde <= query.hasta, {
    message: 'La fecha "Desde" no puede ser posterior a "Hasta"',
    path: ['hasta'],
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
  /** null si el caso interno se registró sin fecha de ingreso. */
  fechaIngresoAlbergue: string | null
  diasEnAlbergue: number | null
  cantidadNinos: number
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

/** Cola de la bandeja: las primeras filas y el total real (el contador de la cabecera). */
export interface ColaBandeja<TFila> {
  filas: TFila[]
  total: number
}

/** Ítem de "Novedades de las áreas" — un evento de `AuditLog` en lenguaje natural. */
export interface NovedadArea {
  id: string
  area: AreaAtencion
  expedienteId: string
  usuariaId: string
  nombreCompleto: string
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
  pendientesReferir: ColaBandeja<FilaColaReferir>
  documentosPendientes: ColaBandeja<FilaDocumentoPendiente>
  enAlbergue: ColaBandeja<FilaEnAlbergue>
  recientes: FilaAtendidaReciente[]
  novedades: NovedadArea[]
  resumenMes: ResumenMesTs
}

/** Una celda de la matriz: cómo se ve el switch y si el usuario puede tocarlo. */
export interface CeldaAcceso {
  visible: boolean
  /** Jurídico: acceso completo por normativa, no se puede restringir. */
  bloqueado: boolean
  /** Área no referida, o documento que todavía no se ha subido. */
  deshabilitado: boolean
}

/** Una fila de la matriz: agresor/tipología/observaciones o un tipo de documento. */
export interface FilaMatrizAccesos {
  clave: 'DATOS_CASO' | TipoDocumentoTrabajoSocial
  etiqueta: string
  descripcion: string
  celdas: Record<AreaAtencion, CeldaAcceso>
}

export interface ColumnaMatrizAccesos {
  area: AreaAtencion
  referida: boolean
  restringible: boolean
}

/** `GET /trabajo-social/expedientes/:id/accesos` — matriz ya calculada por el backend. */
export interface MatrizAccesos {
  expedienteId: string
  numero: string
  columnas: ColumnaMatrizAccesos[]
  filas: FilaMatrizAccesos[]
}

/**
 * `GET /trabajo-social/expedientes/:id/compartido` — lo que un área publica hacia Trabajo Social
 * sobre un caso, ya redactado por el backend. Solo lectura.
 */
export interface CompartidoArea {
  area: AreaAtencion
  referida: boolean
  /** Vacío si el área no fue referida o todavía no ha compartido nada. */
  lineas: string[]
}

/** Resultado de `POST /trabajo-social/expedientes/:id/referidos`. */
export interface ReferidoCreado {
  id: string
  area: AreaAtencion
  prioridad: PrioridadReferido
  profesionalAsignadoId: string | null
  createdAt: string
}

/** `GET /trabajo-social/profesionales?area=` — select del modal Referir. */
export const listarProfesionalesQuerySchema = z.object({ area: areaAtencionSchema })
export type ListarProfesionalesQuery = z.infer<typeof listarProfesionalesQuerySchema>

export interface ProfesionalArea {
  id: string
  nombreCompleto: string
  puesto: string | null
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
  /** false en las filas de hijas/hijos. No es una columna del Excel. */
  esUsuaria: boolean
}

/** Filas que trae la vista previa del reporte; el Excel lleva todas. */
export const FILAS_VISTA_PREVIA_REPORTE = 20

/** Una barra de un desglose del reporte (p. ej. "14 a 30 años: 12"). */
export interface ConteoReporte {
  clave: string
  etiqueta: string
  total: number
}

/** `GET /trabajo-social/reportes/poblacion-beneficiada`: totales, desgloses y las primeras filas. */
export interface ReportePoblacionBeneficiada {
  totales: {
    personas: number
    usuarias: number
    ninos: number
  }
  desgloses: {
    /** Usuarias e hijas/hijos, con la edad que tenían a la fecha del caso. */
    rangoEdad: ConteoReporte[]
    /** Usuarias e hijas/hijos (heredan el de la madre). */
    grupoEtnico: ConteoReporte[]
    /** Solo usuarias. Un caso puede tener varias tipologías: cada una suma 1. */
    tipologia: ConteoReporte[]
  }
  vistaPrevia: FilaPoblacionBeneficiada[]
}

/** Fila de la Bitácora del expediente (lectura de `AuditLog`, solo lectura). */
export interface EventoBitacora {
  id: string
  /** Instante ISO del evento. */
  fecha: string
  accion: string
  texto: string
  /** Nombre del personal que lo hizo; null si la cuenta ya no existe. */
  autor: string | null
  /** Caso al que pertenece; null para cambios de los datos de la usuaria. */
  numeroExpediente: string | null
  /** Registro, referido o proceso: se marca con el punto de color en la línea de tiempo. */
  destacado: boolean
}

/** Roles válidos como columna de la matriz de accesos — mismo orden que en el prototipo. */
export const AREAS_MATRIZ_ACCESOS = AREAS_ATENCION
