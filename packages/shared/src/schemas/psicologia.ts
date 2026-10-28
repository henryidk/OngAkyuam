import { z } from 'zod'
import {
  ALCANCES_PSICOLOGIA,
  BUSQUEDA_CONSULTAS_PSICOLOGIA_MIN,
  CLINICAS_PSICOLOGIA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  ESTADOS_ATENCION_PSICOLOGICA,
  ESTADOS_CITA_PSICOLOGICA,
  ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA,
  FILTROS_PROCESOS_PSICOLOGIA,
  FILTROS_USUARIAS_PSICOLOGIA,
  MAX_DIAS_RANGO_HISTORIAL_PSICOLOGIA,
  MODALIDADES_CITA,
  MOTIVOS_CIERRE_PSICOLOGIA,
  TIPOS_CITA_PSICOLOGICA,
} from '../catalogos/psicologia.js'
import type { GENEROS, GRUPOS_ETNICOS } from '../catalogos/registroUsuaria.js'
import type { TipoDocumento } from './documentos.js'
import type { TipoRegistro } from './registroUsuaria.js'
import type { ConteoReporte } from './trabajoSocial.js'
import type { VistaMedicaParaPsicologia } from './medica.js'
import { diasEntreFechasGT } from '../timezone.js'

/** "YYYY-MM-DD" — mismo criterio que registroUsuaria.ts: fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** Valor crudo de un `<input type="datetime-local">` — se interpreta como hora de Guatemala vía `parseLocalGT`, nunca como UTC directo. */
const fechaHoraLocalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha y hora inválidas')

export const modalidadCitaSchema = z.enum(MODALIDADES_CITA)
export const estadoCitaPsicologicaSchema = z.enum(ESTADOS_CITA_PSICOLOGICA)
export const estadoAtencionPsicologicaSchema = z.enum(ESTADOS_ATENCION_PSICOLOGICA)
export const tipoCitaPsicologicaSchema = z.enum(TIPOS_CITA_PSICOLOGICA)
export const clinicaPsicologiaSchema = z.enum(CLINICAS_PSICOLOGIA)
export type ClinicaPsicologia = z.infer<typeof clinicaPsicologiaSchema>

/** Largo máximo del enfoque terapéutico de una sesión. */
export const ENFOQUE_TERAPEUTICO_MAX = 2000

// ---- Rediseño: cita sin modalidad ni lugar, cierre, visibilidad y "¿Qué sigue?" ----

/** Contador de concurrencia optimista: el cliente devuelve la versión que leyó. */
const versionSchema = z.number().int().min(1)

export const motivoCierrePsicologiaSchema = z.enum(MOTIVOS_CIERRE_PSICOLOGIA)
export type MotivoCierrePsicologia = z.infer<typeof motivoCierrePsicologiaSchema>

export const duracionCitaPsicologicaSchema = z.literal(DURACIONES_CITA_PSICOLOGICA_MINUTOS, 'Duración inválida')

/**
 * Cita del rediseño: la atención es solo presencial en la ONG, así que no se pide modalidad ni
 * lugar (el backend guarda `PRESENCIAL`). Es el body de programar/reprogramar una cita de un
 * proceso y de las dos aperturas (`bandeja/:referidoId/atender`, `usuarias/:id/procesos`), donde
 * la cita es la de primera atención.
 */
export const agendarCitaPsicologicaSchema = z.object({
  fechaHora: fechaHoraLocalSchema,
  duracionMinutos: duracionCitaPsicologicaSchema.default(DURACION_CITA_PSICOLOGICA_POR_DEFECTO),
  /** Hijo/a que se atiende dentro del proceso de la madre; null = la usuaria. */
  ninoId: z.uuid().nullable().default(null),
  /** true solo en el reintento tras que la psicóloga confirmó el aviso de traslape. */
  confirmarTraslape: z.boolean().default(false),
})
export type AgendarCitaPsicologicaInput = z.infer<typeof agendarCitaPsicologicaSchema>

/**
 * `POST /psicologia/citas/:citaId/reprogramacion` — mueve una cita a otra fecha. La persona
 * atendida no se elige: es la misma de la cita que se mueve.
 */
export const moverCitaPsicologicaSchema = agendarCitaPsicologicaSchema.omit({ ninoId: true })
export type MoverCitaPsicologicaInput = z.infer<typeof moverCitaPsicologicaSchema>

export const RESUMEN_CIERRE_PSICOLOGIA_MAX = 2000

/** `POST /psicologia/procesos/:id/cierre`. */
export const cerrarProcesoPsicologiaSchema = z
  .object({
    motivo: motivoCierrePsicologiaSchema,
    resumen: z.string().trim().max(RESUMEN_CIERRE_PSICOLOGIA_MAX),
    version: versionSchema,
  })
  .refine((datos) => datos.motivo !== 'OTRO' || datos.resumen.length > 0, {
    path: ['resumen'],
    message: 'Describa el motivo de cierre',
  })
export type CerrarProcesoPsicologiaInput = z.infer<typeof cerrarProcesoPsicologiaSchema>

/**
 * `PATCH /psicologia/procesos/:id/visibilidad` — qué otras áreas ven etapa, fechas y documentos
 * del proceso. Trabajo Social no es un interruptor: siempre los ve. Las notas de sesión no
 * entran aquí en ningún caso.
 */
export const visibilidadProcesoPsicologiaSchema = z.object({
  visibleJuridico: z.boolean(),
  visibleMedica: z.boolean(),
  version: versionSchema,
})
export type VisibilidadProcesoPsicologiaInput = z.infer<typeof visibilidadProcesoPsicologiaSchema>

export const TIPOS_SIGUIENTE_PASO_SESION = ['PROGRAMAR', 'NINGUNA', 'CERRAR'] as const

/**
 * "¿Qué sigue?" al guardar una sesión. `PROGRAMAR` crea la próxima cita en la misma transacción;
 * `CERRAR` solo le indica al frontend que abra el diálogo de cierre después de guardar — el
 * backend nunca cierra un proceso de forma implícita.
 */
/** En qué puede quedar una cita al registrarla. */
export const RESULTADOS_SESION_PSICOLOGICA = ['ATENDIDA', 'NO_ASISTIO', 'CANCELADA'] as const satisfies readonly EstadoCitaPsicologica[]
export type ResultadoSesionPsicologica = (typeof RESULTADOS_SESION_PSICOLOGICA)[number]

export const siguientePasoSesionSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('PROGRAMAR'),
    fechaHora: fechaHoraLocalSchema,
    duracionMinutos: duracionCitaPsicologicaSchema,
    // Opcional y sin `.default()`: un default aquí vuelve distinto el tipo de entrada del de
    // salida y rompe el `useForm` del registro actual bajo `tsc -b`. Ausente = false.
    confirmarTraslape: z.boolean().optional(),
  }),
  z.object({ tipo: z.literal('NINGUNA') }),
  z.object({ tipo: z.literal('CERRAR') }),
])
export type SiguientePasoSesion = z.infer<typeof siguientePasoSesionSchema>

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
    /** Dónde se atendió: obligatoria al terminar el registro de una sesión atendida. */
    clinica: clinicaPsicologiaSchema.nullable(),
    enfoqueTerapeutico: z
      .string()
      .max(ENFOQUE_TERAPEUTICO_MAX, `Máximo ${ENFOQUE_TERAPEUTICO_MAX} caracteres`),
    borrador: z.boolean().default(false),
    /** "¿Qué sigue?" — ausente equivale a `NINGUNA` (los formularios anteriores al rediseño no lo envían). */
    siguiente: siguientePasoSesionSchema.optional(),
  })
  // Un registro terminado dice en qué quedó la cita; "programada" o "reprogramada" no son resultados.
  .refine(
    (datos) =>
      datos.borrador || (RESULTADOS_SESION_PSICOLOGICA as readonly string[]).includes(datos.estado),
    { message: 'Elija el resultado de la sesión', path: ['estado'] },
  )
  .refine(
    (datos) =>
      datos.borrador || datos.estado === 'ATENDIDA' || datos.motivoNoAsistencia.trim().length > 0,
    {
      message: 'El motivo es requerido cuando la cita no fue atendida',
      path: ['motivoNoAsistencia'],
    },
  )
  // Un borrador puede quedar sin clínica; una sesión atendida ya registrada, no.
  .refine((datos) => datos.borrador || datos.estado !== 'ATENDIDA' || datos.clinica !== null, {
    message: 'Elige la clínica donde se atendió la sesión.',
    path: ['clinica'],
  })
export type RegistroConsultaInput = z.infer<typeof registroConsultaSchema>

/** Rango de fechas de calendario (ambos extremos incluidos) — query de `GET /psicologia/agenda/citas`. */
export const rangoFechasQuerySchema = z.object({
  desde: fechaCalendarioSchema,
  hasta: fechaCalendarioSchema,
})
export type RangoFechasQuery = z.infer<typeof rangoFechasQuerySchema>

/** `GET /psicologia/indicadores` — siempre "mis" casos del año consultado (§5.5, §7.4 del plan). */
export const indicadoresQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
})
export type IndicadoresQuery = z.infer<typeof indicadoresQuerySchema>

// ---- Rediseño: queries de Procesos, Usuarias y huecos de la agenda ----

export const BUSQUEDA_PSICOLOGIA_MAX = 80

export const filtroProcesosPsicologiaSchema = z.enum(FILTROS_PROCESOS_PSICOLOGIA)
export type FiltroProcesosPsicologia = z.infer<typeof filtroProcesosPsicologiaSchema>

export const alcancePsicologiaSchema = z.enum(ALCANCES_PSICOLOGIA)
export type AlcancePsicologia = z.infer<typeof alcancePsicologiaSchema>

/** `GET /psicologia/procesos` — mis procesos o los de toda el área (`de`), paginados por cursor. */
export const listarProcesosPsicologiaQuerySchema = z.object({
  filtro: filtroProcesosPsicologiaSchema.default('ACTIVOS'),
  de: alcancePsicologiaSchema.default('MIOS'),
  q: z.string().trim().min(3).max(BUSQUEDA_PSICOLOGIA_MAX).optional(),
  cursor: z.string().optional(),
})
export type ListarProcesosPsicologiaQuery = z.infer<typeof listarProcesosPsicologiaQuerySchema>

/** `GET /psicologia/procesos/:id/sesiones` — sesiones del proceso, de la más reciente a la más antigua. */
export const sesionesProcesoPsicologiaQuerySchema = z.object({ cursor: z.string().optional() })
export type SesionesProcesoPsicologiaQuery = z.infer<typeof sesionesProcesoPsicologiaQuerySchema>

export const filtroUsuariasPsicologiaSchema = z.enum(FILTROS_USUARIAS_PSICOLOGIA)
export type FiltroUsuariasPsicologia = z.infer<typeof filtroUsuariasPsicologiaSchema>

/** `GET /psicologia/usuarias` — referidas sin tomar (de cualquier psicóloga) o tomadas por mí. */
export const listarUsuariasPsicologiaQuerySchema = z.object({
  filtro: filtroUsuariasPsicologiaSchema.optional(),
  q: z.string().trim().max(BUSQUEDA_PSICOLOGIA_MAX).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
})
export type ListarUsuariasPsicologiaQuery = z.infer<typeof listarUsuariasPsicologiaQuerySchema>

export const estadoHistorialConsultasPsicologiaSchema = z.enum(ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA)
export type EstadoHistorialConsultasPsicologia = z.infer<typeof estadoHistorialConsultasPsicologiaSchema>

/**
 * Cuerpo de `POST /psicologia/consultas/historial/busqueda`. El nombre buscado identifica a una
 * sobreviviente: en el cuerpo no queda en logs de acceso ni en el historial del navegador.
 */
export const buscarHistorialConsultasPsicologiaSchema = z
  .object({
    desde: fechaCalendarioSchema,
    hasta: fechaCalendarioSchema,
    q: z
      .string()
      .trim()
      .max(BUSQUEDA_PSICOLOGIA_MAX)
      .optional()
      .transform((valor) => (valor && valor.length >= BUSQUEDA_CONSULTAS_PSICOLOGIA_MIN ? valor : undefined)),
    clinica: clinicaPsicologiaSchema.optional(),
    estado: estadoHistorialConsultasPsicologiaSchema.optional(),
    de: alcancePsicologiaSchema.default('MIOS'),
    cursor: z.string().max(200).optional(),
  })
  .refine((v) => diasEntreFechasGT(v.desde, v.hasta) >= 0, {
    message: 'La fecha final no puede ser anterior a la inicial',
    path: ['hasta'],
  })
  .refine((v) => diasEntreFechasGT(v.desde, v.hasta) < MAX_DIAS_RANGO_HISTORIAL_PSICOLOGIA, {
    message: `El rango no puede pasar de ${MAX_DIAS_RANGO_HISTORIAL_PSICOLOGIA} días`,
    path: ['hasta'],
  })
export type BuscarHistorialConsultasPsicologiaInput = z.input<typeof buscarHistorialConsultasPsicologiaSchema>
export type BuscarHistorialConsultasPsicologiaDatos = z.output<typeof buscarHistorialConsultasPsicologiaSchema>

/** `GET /psicologia/agenda/huecos` — huecos libres de un día de calendario de Guatemala. */
export const huecosAgendaQuerySchema = z.object({ fecha: fechaCalendarioSchema })
export type HuecosAgendaQuery = z.infer<typeof huecosAgendaQuerySchema>

/**
 * `GET /psicologia/agenda/disponibilidad` — horas de inicio libres de cada día hábil desde
 * `desde`, para una cita de `duracion` minutos. Es una sugerencia: agendar fuera sigue permitido.
 */
export const disponibilidadPsicologiaQuerySchema = z.object({
  desde: fechaCalendarioSchema,
  duracion: z.coerce.number().pipe(duracionCitaPsicologicaSchema),
})
export type DisponibilidadPsicologiaQuery = z.infer<typeof disponibilidadPsicologiaQuerySchema>

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
  clinica: ClinicaPsicologia | null
  enfoqueTerapeutico: string | null
  borrador: boolean
  reprogramadaDesdeId: string | null
  atendidoPor: string
  documento: DocumentoCitaDto | null
}

/** `codigo` del 409 que el backend responde cuando la cita se cruza con otra de la misma psicóloga. */
export const CODIGO_TRASLAPE_CITA = 'TRASLAPE_CITA'

/** Cuerpo del 409 de traslape al programar o reprogramar: es un aviso, no un bloqueo duro. */
export interface ConflictoTraslapeCita {
  message: string
  codigo: typeof CODIGO_TRASLAPE_CITA
  detalle: { citas: CitaResumen[] }
}

/** Página de resultados con cursor — forma compartida por toda la paginación por cursor del módulo (§7.5 del plan). */
export interface PaginaConCursor<T> {
  items: T[]
  siguienteCursor: string | null
}

/** `GET /psicologia/citas/:id` — permalink de una cita puntual, cada fila del historial enlaza aquí (§5.3 del plan). */
export interface CitaPsicologicaDetalle extends CitaResumen {
  expedienteId: string
  numero: string
  usuariaNombreCompleto: string
  procesoId: string
  procesoCodigo: string
  procesoEtapa: EstadoAtencionPsicologica
  /** Hijo/a que se atiende en esta cita; null = la usuaria. */
  ninoNombreCompleto: string | null
  /**
   * Clínica con la que se propone el registro: la de la cita si ya tiene, o la última que usó
   * quien la consulta. null si nunca registró una.
   */
  clinicaSugerida: ClinicaPsicologia | null
}

/** Respuesta de `PUT /psicologia/citas/:id/registro`. */
export interface ConsultaRegistradaDto {
  cita: CitaResumen
  procesoId: string
  /** Era la primera sesión atendida: el proceso pasó de Inicio a Seguimiento. */
  pasoASeguimiento: boolean
  /** La cita que se programó desde "¿Qué sigue?", si se eligió programar. */
  proximaCita: CitaProgramadaDto | null
}

/**
 * Desgloses de un periodo. Los cuatro primeros cuentan **personas atendidas distintas** (una
 * persona con dos tipologías suma en ambas); los dos últimos cuentan **citas**.
 */
export interface DesglosesIndicadores {
  rangoEdad: ConteoReporte[]
  grupoEtnico: ConteoReporte[]
  tipologia: ConteoReporte[]
  municipio: ConteoReporte[]
  citasPorEstado: ConteoReporte[]
  citasPorTipo: ConteoReporte[]
}

/** Cifras de un periodo (el año completo o uno de sus meses). */
export interface PeriodoIndicadores {
  /** Personas distintas (usuarias e hijos/as) con al menos una sesión atendida. */
  personasAtendidas: number
  sesionesRealizadas: number
  inasistencias: number
  /** Todas las citas del periodo, en cualquier estado. */
  citas: number
  desgloses: DesglosesIndicadores
}

/**
 * `GET /psicologia/indicadores` — siempre "mis" procesos del año consultado. Solo cifras: nunca
 * nombres ni datos de una persona.
 */
export interface IndicadoresPsicologia {
  anio: number
  /** Del año en curso hacia atrás, hasta el de mi primer proceso. */
  aniosDisponibles: number[]
  procesosActivos: number
  procesosIniciadosEnElAnio: number
  procesosCerradosEnElAnio: number
  anual: PeriodoIndicadores
  /** Los 12 meses, de enero a diciembre, con ceros donde no hubo atención. */
  meses: PeriodoIndicadores[]
}

// ---- Rediseño: Área de atención, Agenda, Procesos y Usuarias ----

/** A quién se atiende en una cita o se piensa atender en una referencia: la usuaria o uno de sus hijos/as. */
export interface PersonaAtendidaDto {
  /** null = la usuaria. */
  ninoId: string | null
  nombreCompleto: string
  /** Años cumplidos, en hora de Guatemala. */
  edad: number
}

/** Tarjeta del Área de atención (`GET /psicologia/bandeja`): referencia que ninguna psicóloga ha tomado. */
export interface ReferenciaBandejaPsicologiaDto {
  referidoId: string
  expedienteId: string
  expedienteNumero: string
  usuariaId: string
  usuariaNombreCompleto: string
  edad: number
  municipio: string | null
  motivo: string | null
  referidoEn: string
  referidoPor: string
  /** Días calendario de Guatemala desde la referencia; se resalta desde `DIAS_ALERTA_ESPERA_PSICOLOGIA`. */
  diasEsperando: number
  /** La usuaria y los hijos/as registrados en el expediente. */
  personas: PersonaAtendidaDto[]
  /** Ya tuvo un proceso psicológico, de cualquier estado: la usuaria regresa. */
  atendidaAntes: boolean
}

/**
 * Lo que una psicóloga ve de un expediente antes de tomar el caso
 * (`GET /psicologia/bandeja/:referidoId/previa`): lo justo para decidir si lo toma. Nunca lleva
 * agresor, dirección, teléfono, DPI ni ubicación: eso se ve después de tomarlo.
 */
export interface ExpedientePreviaTomaDto {
  referidoId: string
  expedienteNumero: string
  usuariaNombreCompleto: string
  edad: number
  municipio: string | null
  /** Etiqueta del catálogo, lista para mostrar. */
  grupoEtnico: string
  /** Etiquetas del Decreto 22-2008. `null` = Trabajo Social no compartió los datos del caso con Psicología. */
  tipologias: string[] | null
  motivo: string | null
  referidoEn: string
  referidoPor: string
  personas: PersonaAtendidaDto[]
}

/** Fila de `GET /psicologia/agenda/por-agendar`: caso que tomé y todavía no tiene primera cita. */
export interface CasoPorAgendarDto {
  referidoId: string
  expedienteId: string
  expedienteNumero: string
  usuariaId: string
  usuariaNombreCompleto: string
  tomadaEn: string
  /** La usuaria primero y luego cada hijo/a: a quién se le puede abrir el proceso. */
  personas: PersonaParaAbrirDto[]
}

/** Persona elegible al agendar la primera cita de un caso: abrirlo es abrir su proceso. */
export interface PersonaParaAbrirDto extends PersonaAtendidaDto {
  /** "04-2026" para la usuaria, "04-2026.01" para un hijo/a. */
  numero: string
  /** Quien ya la atiende en un proceso abierto; null = se le puede abrir el suyo. */
  atendidaPor: string | null
}

/**
 * Fila de `GET /psicologia/bandeja/por-reasignar`: caso o proceso abierto cuya psicóloga ya no
 * tiene la cuenta activa. Lo ve toda el área para que una lo tome; no lleva texto clínico.
 */
export interface CasoPorReasignarDto {
  procesoId: string
  expedienteNumero: string
  usuariaId: string
  usuariaNombreCompleto: string
  edad: number
  municipio: string | null
  /** "05-2026"; `null` si la psicóloga anterior lo tomó pero nunca le agendó la primera cita. */
  codigo: string | null
  etapa: EstadoAtencionPsicologica
  sesionesAtendidas: number
  /** Cuándo abrió el proceso; `null` mientras no tenga primera cita. */
  fechaInicio: string | null
  /** Nombre de la psicóloga que lo llevaba. */
  psicologaAnterior: string
  /** Citas que siguen programadas: se cancelan al tomar el caso, no se heredan. */
  citasProgramadas: number
  personas: PersonaAtendidaDto[]
}

/** Respuesta de `POST /psicologia/bandeja/por-reasignar/:procesoId/tomar`. */
export interface CasoReasignadoDto {
  procesoId: string
  /** Solo viene si el caso aún no tenía primera cita: toca agendarla desde la agenda. */
  referidoIdPorAgendar: string | null
  citasCanceladas: number
}

/** Cita tal como la pinta la agenda del rediseño: sin modalidad, lugar ni texto clínico. */
export interface CitaAgendaDto {
  id: string
  procesoId: string
  /** "05-2026". */
  procesoCodigo: string
  usuariaId: string
  usuariaNombreCompleto: string
  persona: PersonaAtendidaDto
  fechaHora: string
  duracionMinutos: number
  tipo: TipoCitaPsicologica
  estado: EstadoCitaPsicologica
  /** Derivado, no se guarda: sigue `PROGRAMADA` y ya terminó su horario. */
  sinRegistrar: boolean
  /** Tiene un registro de sesión guardado como borrador. */
  borrador: boolean
}

/** Tramo libre de un día, en minutos desde la medianoche de Guatemala. */
export interface HuecoLibreDto {
  desdeMin: number
  hastaMin: number
}

/** Referencia mínima a una cita, para las columnas "Última sesión" y "Próxima cita". */
export interface CitaRefDto {
  id: string
  fechaHora: string
}

/**
 * Fila de `GET /psicologia/agenda/procesos`: un proceso mío sin cerrar, con lo necesario para
 * programarle una cita (a quién se puede atender) y saber si se quedó sin siguiente fecha.
 */
export interface ProcesoParaAgendarDto {
  procesoId: string
  codigo: string
  usuariaId: string
  usuariaNombreCompleto: string
  /** La persona del proceso (cada persona lleva el suyo): un solo elemento. */
  personas: PersonaAtendidaDto[]
  /** La cita programada que sigue: la que está en curso o, si no hay, la primera futura. */
  proximaCita: CitaRefDto | null
  /** Tiene una cita que ya pasó sin sesión ni inasistencia: lo pendiente es registrarla. */
  tieneCitaSinRegistrar: boolean
}

/** Respuesta de programar o mover una cita desde la agenda. */
export interface CitaProgramadaDto {
  id: string
  procesoId: string
  fechaHora: string
}

/** Fila de `GET /psicologia/procesos`. */
export interface ProcesoPsicologiaResumen {
  id: string
  codigo: string
  usuariaId: string
  usuariaNombreCompleto: string
  expedienteNumero: string
  etapa: EstadoAtencionPsicologica
  /** A quién atiende el proceso: la usuaria o uno de sus hijos/as. */
  persona: PersonaAtendidaDto
  sesionesAtendidas: number
  ultimaSesion: CitaRefDto | null
  proximaCita: CitaRefDto | null
  fechaInicio: string
  fechaCierre: string | null
}

/** Fila de `GET /psicologia/procesos`: el resumen más quién lo lleva. */
export interface FilaProcesoPsicologia extends ProcesoPsicologiaResumen {
  /** Nombre de la responsable. */
  psicologa: string
  /** Lo lleva quien consulta. */
  propio: boolean
}

export type ProcesosPsicologiaPaginados = PaginaConCursor<FilaProcesoPsicologia>

/** `GET /psicologia/procesos/resumen` — tarjetas de Procesos y contadores del menú lateral. */
export interface ResumenProcesosPsicologia {
  /** Tarjetas de "Míos". */
  procesos: Record<FiltroProcesosPsicologia, number>
  /** Tarjetas de "Del equipo": todos los procesos del área que tienen responsable. */
  procesosEquipo: Record<FiltroProcesosPsicologia, number>
  referenciasSinTomar: number
  /** Casos y procesos abiertos de psicólogas con la cuenta desactivada, que nadie ha retomado. */
  casosPorReasignar: number
  casosPorAgendar: number
  /** Sesiones mías que ya empezaron y siguen sin registrar: la insignia de Consultas. */
  sesionesPorRegistrar: number
}

export const ACCIONES_PROCESO_PSICOLOGIA = ['PROGRAMAR_CITA', 'REGISTRAR_SESION', 'CERRAR', 'EDITAR_VISIBILIDAD'] as const
export type AccionProcesoPsicologia = (typeof ACCIONES_PROCESO_PSICOLOGIA)[number]

/** Proceso ya cerrado que llevó otra psicóloga con una usuaria que quien consulta también atiende. */
export interface ProcesoColegaPsicologiaResumen extends ProcesoPsicologiaResumen {
  /** Nombre de la psicóloga que lo llevó. */
  psicologa: string
}

/** Quien llevaba un proceso abierto hasta que otra psicóloga lo tomó por reasignación. */
export interface PsicologaAnteriorDto {
  nombre: string
  /** Instante en que la siguiente psicóloga tomó el proceso. */
  hasta: string
}

/**
 * `GET /psicologia/procesos/:id` — para la psicóloga dueña del proceso, o en solo lectura para
 * quien retoma a la usuaria cuando el proceso de su colega ya está cerrado.
 */
/** Cuántas citas sin registrar lista el detalle de un proceso: en la práctica es una. */
export const MAX_CITAS_SIN_REGISTRAR_EN_DETALLE = 5

export interface ProcesoPsicologiaDetalle extends ProcesoPsicologiaResumen {
  expedienteId: string
  version: number
  psicologa: string
  /** El proceso lo llevó otra psicóloga: se lee completo, no se modifica nada. */
  soloLectura: boolean
  /** Psicólogas que lo llevaron antes de que cambiara de manos, de la más reciente a la más antigua. */
  psicologasAnteriores: PsicologaAnteriorDto[]
  motivoReferencia: string | null
  motivoCierre: MotivoCierrePsicologia | null
  resumenCierre: string | null
  personasAtendidas: PersonaAtendidaDto[]
  /**
   * Citas que ya pasaron sin sesión ni inasistencia (misma regla que la agenda), de la más
   * antigua a la más reciente y como mucho `MAX_CITAS_SIN_REGISTRAR_EN_DETALLE`. Vacío en un
   * proceso cerrado o de solo lectura: ahí no queda nada que registrar.
   */
  citasSinRegistrar: CitaRefDto[]
  visibilidad: { visibleJuridico: boolean; visibleMedica: boolean }
  /** Lo calcula el backend; el frontend no repite las reglas de etapa. */
  accionesDisponibles: AccionProcesoPsicologia[]
}

/**
 * Fila de `GET /psicologia/procesos/:id/sesiones` — con texto clínico: nunca sale de Psicología.
 * La lee su dueña y, con el proceso ya cerrado, la colega que retoma a la misma usuaria.
 */
export interface SesionProcesoDto {
  citaId: string
  /** Número de sesión dentro del proceso; null en una inasistencia. */
  numero: number | null
  fechaHora: string
  duracionMinutos: number
  estado: EstadoCitaPsicologica
  persona: PersonaAtendidaDto
  temas: string | null
  intervencion: string | null
  recomendaciones: string | null
  acuerdos: string | null
  observaciones: string | null
  motivoNoAsistencia: string | null
  clinica: ClinicaPsicologia | null
  enfoqueTerapeutico: string | null
  documento: DocumentoCitaDto | null
}

export type SesionesProcesoPaginadas = PaginaConCursor<SesionProcesoDto>

// ---- Consultas: Por registrar e Historial ----

/** Fila de `GET /psicologia/consultas/por-registrar`: una sesión mía que ya empezó y sigue sin registrar. */
export interface SesionPorRegistrarDto {
  citaId: string
  procesoId: string
  procesoCodigo: string
  usuariaNombreCompleto: string
  persona: PersonaAtendidaDto
  fechaHora: string
  duracionMinutos: number
  tipo: TipoCitaPsicologica
  /** Ya tiene un borrador guardado: "Registrar" retoma lo escrito. */
  borrador: boolean
}

/** Fila del historial: solo metadatos. Las notas clínicas se piden al abrirla (y la apertura se audita). */
export interface FilaHistorialConsultaPsicologiaDto {
  citaId: string
  procesoId: string
  procesoCodigo: string
  usuariaNombreCompleto: string
  persona: PersonaAtendidaDto
  fechaHora: string
  estado: EstadoHistorialConsultasPsicologia
  clinica: ClinicaPsicologia | null
  atendidoPor: string
  /** La atendió quien consulta. */
  propia: boolean
  /** Tiene la hoja de evolución escaneada. */
  tieneHoja: boolean
}

export type HistorialConsultasPsicologiaPaginado = PaginaConCursor<FilaHistorialConsultaPsicologiaDto>

/** `GET /psicologia/consultas/:citaId` — la sesión completa, con su proceso y quién la atendió. */
export interface DetalleConsultaPsicologiaDto extends SesionProcesoDto {
  procesoId: string
  procesoCodigo: string
  usuariaId: string
  usuariaNombreCompleto: string
  atendidoPor: string
}

/** Respuesta de `POST /psicologia/bandeja/:referidoId/tomar`: el caso ya es de quien lo tomó. */
export interface CasoPsicologiaTomadoDto {
  referidoId: string
  procesoId: string
}

/** Respuesta de las dos aperturas de proceso (atender una referencia, abrir desde la ficha). */
export interface ProcesoPsicologiaAbiertoDto {
  procesoId: string
  codigo: string
  /** La cita de primera atención que se creó junto con el proceso. */
  citaId: string
}

/** Respuesta de `POST /psicologia/procesos/:id/cierre`. */
export interface ProcesoPsicologiaCerradoDto {
  id: string
  version: number
  /** Citas programadas a futuro que se cancelaron con el cierre. */
  citasCanceladas: number
}

/** Respuesta de `PATCH /psicologia/procesos/:id/visibilidad`. */
export interface VisibilidadProcesoPsicologiaDto {
  id: string
  version: number
  visibleJuridico: boolean
  visibleMedica: boolean
}

/**
 * Lo único de un proceso psicológico que puede cruzar a otra área. Es un tipo aparte, y no un
 * recorte de `ProcesoPsicologiaDetalle`, para que agregarle un campo clínico al detalle no lo
 * filtre hacia afuera por accidente.
 */
export interface ProcesoPsicologiaCompartidoDto {
  codigo: string
  etapa: EstadoAtencionPsicologica
  /** null = caso tomado al que todavía no se le agenda la primera cita. */
  fechaInicio: string | null
  fechaCierre: string | null
  proximaCita: string | null
  /** Documentos subidos al proceso (p. ej. la Hoja de evolución de cada sesión): solo tipo y fecha. */
  documentos: DocumentoProcesoCompartidoDto[]
}

export interface DocumentoProcesoCompartidoDto {
  id: string
  tipo: TipoDocumento
  subidoEn: string
}

/** Columna "Proceso" de la lista de Usuarias; null = todavía sin procesos. */
export type EstadoProcesoUsuariaPsicologia = 'ACTIVO' | 'CERRADO'

/** Fila de `GET /psicologia/usuarias`. */
export interface FilaUsuariaPsicologia {
  usuariaId: string
  nombreCompleto: string
  dpi: string | null
  edad: number
  expedienteNumero: string
  estadoProceso: EstadoProcesoUsuariaPsicologia | null
  /** Personas de la familia (la usuaria y sus hijos/as) con un proceso abierto. */
  personasEnAtencion: number
  /** `SIN_TOMAR` = nadie la ha tomado; `POR_AGENDAR` = la tomé y falta su primera cita; null = nada pendiente. */
  referenciaPendiente: ReferenciaPendientePsicologia | null
  ultimaActividadEn: string
}

/** `GET /psicologia/usuarias` — página de filas + contador de cada chip (con la búsqueda aplicada). */
export interface ListaUsuariasPsicologia {
  filas: FilaUsuariaPsicologia[]
  pagina: number
  porPagina: number
  total: number
  contadores: { TODAS: number } & Record<FiltroUsuariasPsicologia, number>
}

export const ESTADOS_REFERENCIA_PSICOLOGIA = ['SIN_TOMAR', 'POR_AGENDAR', 'ATENDIDA'] as const
export type EstadoReferenciaPsicologia = (typeof ESTADOS_REFERENCIA_PSICOLOGIA)[number]
/** Referencia que todavía pide algo a la psicóloga: tomarla, o agendarle la primera cita. */
export type ReferenciaPendientePsicologia = Exclude<EstadoReferenciaPsicologia, 'ATENDIDA'>

export interface ReferenciaHistorialPsicologiaDto {
  referidoId: string
  expedienteId: string
  expedienteNumero: string
  referidoEn: string
  referidoPor: string
  motivo: string | null
  estado: EstadoReferenciaPsicologia
}

/** `GET /psicologia/usuarias/:usuariaId` — encabezado de la ficha y lo que Psicología lleva de la usuaria. */
export interface FichaUsuariaPsicologiaDto {
  usuaria: {
    id: string
    nombreCompleto: string
    dpi: string | null
    edad: number
    grupoEtnico: (typeof GRUPOS_ETNICOS)[number]
    municipio: string | null
  }
  /** El expediente más reciente referido a Psicología: de él salen los datos y documentos de Trabajo Social. */
  expediente: { id: string; numero: string; tipoRegistro: TipoRegistro; enAlbergue: boolean }
  contadores: { enProceso: number; cerrados: number }
  /** Solo los míos; de los de otra psicóloga no se devuelve nada. */
  procesos: ProcesoPsicologiaResumen[]
  /** Procesos ya cerrados que llevaron otras psicólogas; vacío si no tengo ningún caso con la usuaria. */
  procesosDeColegas: ProcesoColegaPsicologiaResumen[]
  /** Más reciente primero. */
  referencias: ReferenciaHistorialPsicologiaDto[]
  /** Se puede abrir un proceso nuevo: no hay uno activo ni una referencia pendiente. */
  puedeAbrirProceso: boolean
  /** Código que tendría el próximo proceso de la usuaria ("04-2026 · Proceso 2"): solo para mostrarlo. */
  codigoProcesoNuevo: string
  /** Hijas e hijos del expediente de la ficha, por su número (.01, .02…), con su atención en Psicología. */
  hijos: HijoFichaPsicologiaDto[]
  /** Fechas de consulta de las atenciones médicas que Medicina compartió con Psicología. */
  medicina: VistaMedicaParaPsicologia[]
}

/** Proceso abierto de una persona, tal como se resume en la ficha de su madre. */
export interface ProcesoAbiertoPersonaDto {
  procesoId: string
  codigo: string
  etapa: EstadoAtencionPsicologica
  /** null = la cuenta que lo llevaba ya no existe en el proceso (no debería pasar en uno abierto). */
  responsable: { nombreCompleto: string; puesto: string | null } | null
  /** Instante de la próxima sesión programada, o null si no tiene. */
  proximaCita: string | null
}

/** Fila "Hijas e hijos" de la ficha de la madre: quién es y qué pasa con su atención. */
export interface HijoFichaPsicologiaDto {
  ninoId: string
  /** Número del hijo/a en el expediente ("04-2026.01"); la ficha muestra solo ".01". */
  numero: string
  nombreCompleto: string
  edad: number
  genero: (typeof GENEROS)[number]
  /** "YYYY-MM-DD". */
  fechaNacimiento: string
  procesoAbierto: ProcesoAbiertoPersonaDto | null
  /** Instante del cierre de su último proceso, si tuvo alguno y no tiene uno abierto. */
  ultimoCierre: string | null
  /** No tiene un proceso abierto y el expediente ya lo tomó alguien del área. */
  puedeAbrirProceso: boolean
  /** Código que tendría su próximo proceso ("04-2026.02", "04-2026.02 · Proceso 2"). */
  codigoProcesoNuevo: string
}
