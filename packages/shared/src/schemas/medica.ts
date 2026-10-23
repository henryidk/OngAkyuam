import { z } from 'zod'
import {
  BUSQUEDA_PACIENTES_MEDICA_MAX,
  BUSQUEDA_PACIENTES_MEDICA_MIN,
  DIAGNOSTICO_MEDICO_MAX,
  DIAS_DISPONIBILIDAD,
  ESTADOS_ATENCION_MEDICA,
  ESTADOS_CITA_MEDICA,
  ESTADOS_CITA_MEDICA_DERIVADOS,
  FILTROS_PACIENTES_MEDICA,
  MAX_DIAS_DISPONIBILIDAD,
  MAX_DIAS_RANGO_HISTORIAL_MEDICA,
  MOTIVO_CONSULTA_MEDICA_MAX,
  MOTIVOS_ALTA_MEDICA,
  NOMBRE_DOCUMENTO_MEDICO_MAX,
  NOTA_ALTA_MEDICA_MAX,
  PLAN_TRATAMIENTO_MAX,
  RANGOS_SIGNOS_VITALES,
  RECETA_LABORATORIOS_MAX,
  TIPOS_DOCUMENTO_MEDICO,
  type SignoVital,
} from '../catalogos/medica.js'
import { diasEntreFechasGT } from '../timezone.js'
import type { PersonaAtendidaDto } from './psicologia.js'
import type { ConteoReporte } from './trabajoSocial.js'

/** "YYYY-MM-DD" — fecha de calendario pura, nunca Date. */
const fechaCalendarioSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** Inicio de una cita "YYYY-MM-DDTHH:mm", en hora de Guatemala (se convierte con `parseLocalGT`). */
const inicioCitaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha y hora inválidas')

/** Contador de concurrencia optimista: el cliente devuelve la versión que leyó. */
const versionSchema = z.number().int().min(1)

// Caracteres de control (salvo tabulador y saltos de línea): no tienen uso en un texto clínico y
// pueden romper el Excel o la vista.
const CARACTERES_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Texto libre saneado: sin caracteres de control, recortado y con el mismo límite de la base. */
function textoLibre(max: number) {
  return z
    .string()
    .overwrite((valor) => valor.replace(CARACTERES_CONTROL, ''))
    .trim()
    .max(max, `Máximo ${max} caracteres`)
}

/** Texto libre opcional: vacío se guarda como `null`. */
function textoOpcional(max: number) {
  return textoLibre(max)
    .nullable()
    .optional()
    .transform((valor) => (valor ? valor : null))
}

export const estadoAtencionMedicaSchema = z.enum(ESTADOS_ATENCION_MEDICA)
export type EstadoAtencionMedica = z.infer<typeof estadoAtencionMedicaSchema>

export const motivoAltaMedicaSchema = z.enum(MOTIVOS_ALTA_MEDICA)
export type MotivoAltaMedica = z.infer<typeof motivoAltaMedicaSchema>

export const estadoCitaMedicaSchema = z.enum(ESTADOS_CITA_MEDICA)
export type EstadoCitaMedica = z.infer<typeof estadoCitaMedicaSchema>

export const estadoCitaMedicaDerivadoSchema = z.enum(ESTADOS_CITA_MEDICA_DERIVADOS)
export type EstadoCitaMedicaDerivado = z.infer<typeof estadoCitaMedicaDerivadoSchema>

export const tipoDocumentoMedicoSchema = z.enum(TIPOS_DOCUMENTO_MEDICO)
export type TipoDocumentoMedico = z.infer<typeof tipoDocumentoMedicoSchema>

export const filtroPacientesMedicaSchema = z.enum(FILTROS_PACIENTES_MEDICA)
export type FiltroPacientesMedica = z.infer<typeof filtroPacientesMedicaSchema>

// ---- Signos vitales ----

/** Un signo vital opcional, validado con el rango de `RANGOS_SIGNOS_VITALES`. */
function signoSchema(clave: SignoVital) {
  const { min, max } = RANGOS_SIGNOS_VITALES[clave]
  return z
    .number('Debe ser un número')
    .min(min, `Debe estar entre ${min} y ${max}`)
    .max(max, `Debe estar entre ${min} y ${max}`)
    .nullable()
}

function enteroSchema(clave: SignoVital) {
  return signoSchema(clave).refine((valor) => valor === null || Number.isInteger(valor), 'Debe ser un número entero')
}

export const signosVitalesSchema = z
  .object({
    presionSistolica: enteroSchema('presionSistolica'),
    presionDiastolica: enteroSchema('presionDiastolica'),
    frecuenciaCardiaca: enteroSchema('frecuenciaCardiaca'),
    frecuenciaResp: enteroSchema('frecuenciaResp'),
    temperaturaC: signoSchema('temperaturaC'),
    saturacionO2: enteroSchema('saturacionO2'),
    glucosaMgDl: enteroSchema('glucosaMgDl'),
    pesoKg: signoSchema('pesoKg'),
    tallaM: signoSchema('tallaM'),
  })
  .refine((s) => (s.presionSistolica === null) === (s.presionDiastolica === null), {
    message: 'Escribe la presión completa, por ejemplo 120/80',
    path: ['presionSistolica'],
  })
export type SignosVitalesDto = z.infer<typeof signosVitalesSchema>

export const SIGNOS_VITALES_VACIOS: SignosVitalesDto = {
  presionSistolica: null,
  presionDiastolica: null,
  frecuenciaCardiaca: null,
  frecuenciaResp: null,
  temperaturaC: null,
  saturacionO2: null,
  glucosaMgDl: null,
  pesoKg: null,
  tallaM: null,
}

/**
 * Índice de masa corporal con un decimal. Se deriva, no se guarda: `null` si falta el peso o la
 * talla.
 */
export function calcularImc(pesoKg: number | null, tallaM: number | null): number | null {
  if (!pesoKg || !tallaM || pesoKg <= 0 || tallaM <= 0) {
    return null
  }
  return Math.round((pesoKg / (tallaM * tallaM)) * 10) / 10
}

/**
 * Lee la presión arterial del campo único "120/80". Devuelve `null` si está vacío y `'invalida'`
 * si no tiene la forma esperada; los rangos se validan después con `signosVitalesSchema`.
 */
export function parsearPresionArterial(
  texto: string,
): { sistolica: number; diastolica: number } | null | 'invalida' {
  const limpio = texto.trim()
  if (!limpio) {
    return null
  }
  const coincidencia = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(limpio)
  if (!coincidencia) {
    return 'invalida'
  }
  return { sistolica: Number(coincidencia[1]), diastolica: Number(coincidencia[2]) }
}

/** Mensaje de error de un signo fuera de rango, o `null` si es válido o está vacío. */
export function errorSignoVital(clave: SignoVital, valor: number | null): string | null {
  if (valor === null) {
    return null
  }
  const { min, max, decimales } = RANGOS_SIGNOS_VITALES[clave]
  if (Number.isNaN(valor)) {
    return 'Debe ser un número'
  }
  if (decimales === 0 && !Number.isInteger(valor)) {
    return 'Debe ser un número entero'
  }
  if (valor < min || valor > max) {
    return `Debe estar entre ${min} y ${max}`
  }
  return null
}

// ---- Entradas (body y query) ----

/**
 * `POST /medica/citas` — programa una cita. Si el expediente no tiene atención activa, la abre
 * (primera consulta). Se identifica el expediente directo o por la referencia de Trabajo Social.
 * La idempotencia va en el header `Idempotency-Key`.
 */
export const programarCitaMedicaSchema = z
  .object({
    expedienteId: z.uuid().optional(),
    referidoId: z.uuid().optional(),
    /** Hijo/a que se atiende; null = la usuaria. */
    ninoId: z.uuid().nullable(),
    inicio: inicioCitaSchema,
  })
  .refine((v) => (v.expedienteId ? 1 : 0) + (v.referidoId ? 1 : 0) === 1, {
    message: 'Indica el expediente o la referencia',
    path: ['expedienteId'],
  })
export type ProgramarCitaMedicaInput = z.infer<typeof programarCitaMedicaSchema>

/** `POST /medica/citas/:id/inasistencia` — con reprogramación opcional en el mismo paso. */
export const inasistenciaCitaMedicaSchema = z.object({
  reprogramarA: inicioCitaSchema.nullable(),
  version: versionSchema,
})
export type InasistenciaCitaMedicaInput = z.infer<typeof inasistenciaCitaMedicaSchema>

/** `POST /medica/citas/:id/reprogramacion` — solo para una inasistencia sin reprogramar. */
export const reprogramarCitaMedicaSchema = z.object({
  inicio: inicioCitaSchema,
  version: versionSchema,
})
export type ReprogramarCitaMedicaInput = z.infer<typeof reprogramarCitaMedicaSchema>

/** `POST /medica/consultas` — registra una consulta, desde una cita o sin cita. */
export const registrarConsultaMedicaSchema = z.object({
  citaId: z.uuid().nullable(),
  atencionId: z.uuid(),
  /** Hijo/a atendido; null = la usuaria. Con cita debe coincidir con el de la cita. */
  ninoId: z.uuid().nullable(),
  motivoConsulta: textoOpcional(MOTIVO_CONSULTA_MEDICA_MAX),
  signos: signosVitalesSchema,
  diagnostico: textoLibre(DIAGNOSTICO_MEDICO_MAX).min(1, 'Escribe el diagnóstico.'),
  planTratamiento: textoOpcional(PLAN_TRATAMIENTO_MAX),
  recetaLaboratorios: textoOpcional(RECETA_LABORATORIOS_MAX),
  /** Próxima consulta (crea la cita en la misma transacción); null = sin próxima por ahora. */
  proxima: inicioCitaSchema.nullable(),
  /** Lote de documentos subidos antes de guardar; null = sin documentos. */
  loteDocumentos: z.uuid().nullable(),
})
export type RegistrarConsultaMedicaInput = z.input<typeof registrarConsultaMedicaSchema>
export type RegistrarConsultaMedicaDatos = z.output<typeof registrarConsultaMedicaSchema>

/** Campos de texto del multipart `POST /medica/consultas/:id/documentos`. */
export const subirDocumentoMedicoSchema = z.object({
  tipo: tipoDocumentoMedicoSchema,
  nombreVisible: textoOpcional(NOMBRE_DOCUMENTO_MEDICO_MAX),
})
export type SubirDocumentoMedicoInput = z.output<typeof subirDocumentoMedicoSchema>

/** Campos de texto del multipart `POST /medica/documentos/pendientes` (antes de guardar la consulta). */
export const subirDocumentoMedicoPendienteSchema = subirDocumentoMedicoSchema.extend({
  lote: z.uuid(),
  /** Atención de la consulta que se está llenando: el archivo queda guardado bajo ella. */
  atencionId: z.uuid(),
})
export type SubirDocumentoMedicoPendienteInput = z.output<typeof subirDocumentoMedicoPendienteSchema>

/** `PATCH /medica/documentos/pendientes/:id` — cambiar el tipo de un documento aún no guardado. */
export const cambiarTipoDocumentoMedicoPendienteSchema = z.object({ tipo: tipoDocumentoMedicoSchema })
export type CambiarTipoDocumentoMedicoPendienteInput = z.infer<typeof cambiarTipoDocumentoMedicoPendienteSchema>

/** `GET /medica/documentos/:id/url?modo=` — "vista" abre el PDF o la imagen en la app. */
export const urlDocumentoMedicoQuerySchema = z.object({
  modo: z.enum(['vista', 'descarga']).default('descarga'),
})
export type UrlDocumentoMedicoQuery = z.output<typeof urlDocumentoMedicoQuerySchema>

/** `POST /medica/atenciones/:id/alta`. */
export const altaAtencionMedicaSchema = z
  .object({
    motivo: motivoAltaMedicaSchema,
    nota: textoOpcional(NOTA_ALTA_MEDICA_MAX),
    version: versionSchema,
  })
  .refine((v) => v.motivo !== 'OTRO' || !!v.nota, {
    message: 'Describe el motivo en la nota',
    path: ['nota'],
  })
export type AltaAtencionMedicaInput = z.input<typeof altaAtencionMedicaSchema>
export type AltaAtencionMedicaDatos = z.output<typeof altaAtencionMedicaSchema>

/** `PATCH /medica/atenciones/:id/visibilidad`. */
export const visibilidadAtencionMedicaSchema = z
  .object({
    juridico: z.boolean().optional(),
    psicologia: z.boolean().optional(),
    version: versionSchema,
  })
  .refine((v) => v.juridico !== undefined || v.psicologia !== undefined, 'Indica qué compartir')
export type VisibilidadAtencionMedicaInput = z.infer<typeof visibilidadAtencionMedicaSchema>

/** `GET /medica/agenda?semana=` — cualquier día de la semana; se normaliza al lunes. */
export const semanaAgendaMedicaQuerySchema = z.object({ semana: fechaCalendarioSchema })
export type SemanaAgendaMedicaQuery = z.infer<typeof semanaAgendaMedicaQuerySchema>

/** `GET /medica/agenda/dia?fecha=`. */
export const diaAgendaMedicaQuerySchema = z.object({ fecha: fechaCalendarioSchema })
export type DiaAgendaMedicaQuery = z.infer<typeof diaAgendaMedicaQuerySchema>

/** `GET /medica/agenda/disponibilidad?desde=&dias=`. */
export const disponibilidadMedicaQuerySchema = z.object({
  desde: fechaCalendarioSchema,
  dias: z.coerce.number().int().min(1).max(MAX_DIAS_DISPONIBILIDAD).default(DIAS_DISPONIBILIDAD),
})
export type DisponibilidadMedicaQuery = z.infer<typeof disponibilidadMedicaQuerySchema>

/** `GET /medica/agenda/programables?referidoId=|usuariaId=` — pacientes a las que se puede programar. */
export const programablesMedicaQuerySchema = z.object({
  referidoId: z.uuid().optional(),
  usuariaId: z.uuid().optional(),
})
export type ProgramablesMedicaQuery = z.infer<typeof programablesMedicaQuerySchema>

/** `GET /medica/pacientes?q=&estado=&cursor=`. */
export const listarPacientesMedicaQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(BUSQUEDA_PACIENTES_MEDICA_MAX)
    .optional()
    .transform((valor) => (valor && valor.length >= BUSQUEDA_PACIENTES_MEDICA_MIN ? valor : undefined)),
  estado: filtroPacientesMedicaSchema.optional(),
  cursor: z.string().max(200).optional(),
})
export type ListarPacientesMedicaQuery = z.output<typeof listarPacientesMedicaQuerySchema>

/** `GET /medica/pacientes/:usuariaId/consultas?persona=&cursor=` — `persona`: "usuaria" o el id de un hijo/a. */
export const consultasPacienteMedicaQuerySchema = z.object({
  persona: z.union([z.literal('usuaria'), z.uuid()]).optional(),
  cursor: z.string().max(200).optional(),
})
export type ConsultasPacienteMedicaQuery = z.infer<typeof consultasPacienteMedicaQuerySchema>

/**
 * Cuerpo de `POST /medica/consultas/historial/busqueda`. Es POST porque `q` puede ser el nombre
 * de una sobreviviente: en el cuerpo no queda en logs de acceso ni en el historial del navegador.
 */
export const buscarHistorialConsultasMedicaSchema = z
  .object({
    desde: fechaCalendarioSchema,
    hasta: fechaCalendarioSchema,
    q: z
      .string()
      .trim()
      .max(BUSQUEDA_PACIENTES_MEDICA_MAX)
      .optional()
      .transform((valor) => (valor && valor.length >= BUSQUEDA_PACIENTES_MEDICA_MIN ? valor : undefined)),
    cursor: z.string().max(200).optional(),
  })
  .refine((v) => diasEntreFechasGT(v.desde, v.hasta) >= 0, {
    message: 'La fecha final no puede ser anterior a la inicial',
    path: ['hasta'],
  })
  .refine((v) => diasEntreFechasGT(v.desde, v.hasta) < MAX_DIAS_RANGO_HISTORIAL_MEDICA, {
    message: `El rango no puede pasar de ${MAX_DIAS_RANGO_HISTORIAL_MEDICA} días`,
    path: ['hasta'],
  })
export type BuscarHistorialConsultasMedicaInput = z.input<typeof buscarHistorialConsultasMedicaSchema>
export type BuscarHistorialConsultasMedicaDatos = z.output<typeof buscarHistorialConsultasMedicaSchema>

/** `GET /medica/consultas/contexto?cita=|usuaria=` — datos para abrir el formulario de consulta. */
export const contextoConsultaMedicaQuerySchema = z
  .object({
    cita: z.uuid().optional(),
    usuaria: z.uuid().optional(),
  })
  .refine((v) => (v.cita ? 1 : 0) + (v.usuaria ? 1 : 0) === 1, 'Indica la cita o la paciente')
export type ContextoConsultaMedicaQuery = z.infer<typeof contextoConsultaMedicaQuerySchema>

/** `GET /medica/reportes?anio=` y `GET /medica/reportes/excel?anio=`. */
export const reportesMedicaQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
})
export type ReportesMedicaQuery = z.infer<typeof reportesMedicaQuerySchema>

// ---- Sugerencia de horario (pura, compartida por los dos modales) ----

/** Un día hábil con las horas libres para una cita. Nunca dice quién ocupa cada hora. */
export interface DisponibilidadDiaDto {
  fecha: string
  libres: string[]
}

export interface HorarioSugerido {
  fecha: string
  hora: string
}

/**
 * Día y hora que el modal propone al abrirse: el día preferido si tiene espacio (si no, el
 * primero con espacio) y, dentro de ese día, la hora preferida si sigue libre (si no, la primera
 * libre). `despuesDe` descarta los días hasta esa fecha inclusive — la inasistencia propone a
 * partir del día siguiente. `null` si no queda ninguna hora libre.
 */
export function sugerirHorario(
  disponibilidad: readonly DisponibilidadDiaDto[],
  preferido: { fecha?: string | null; hora?: string | null; despuesDe?: string | null } = {},
): HorarioSugerido | null {
  const candidatos = disponibilidad.filter(
    (dia) => dia.libres.length > 0 && (!preferido.despuesDe || dia.fecha > preferido.despuesDe),
  )
  const dia = candidatos.find((d) => d.fecha === preferido.fecha) ?? candidatos[0]
  if (!dia) {
    return null
  }
  const hora = preferido.hora && dia.libres.includes(preferido.hora) ? preferido.hora : dia.libres[0]!
  return { fecha: dia.fecha, hora }
}

// ---- DTOs de respuesta ----

/** Tarjeta del Área de atención: referencia de Trabajo Social pendiente de primera consulta. */
export interface ReferenciaBandejaMedicaDto {
  referidoId: string
  expedienteId: string
  expedienteNumero: string
  usuariaId: string
  usuariaNombreCompleto: string
  edad: number
  motivo: string | null
  referidoEn: string
  referidoPor: string
  /** La usuaria primero y luego sus hijos/as del expediente. */
  personas: PersonaAtendidaDto[]
}

/** Una cita tal como la muestra la Agenda. Nunca incluye datos clínicos. */
export interface CitaAgendaMedicaDto {
  id: string
  version: number
  atencionId: string
  codigoAtencion: string
  expedienteId: string
  usuariaId: string
  usuariaNombreCompleto: string
  persona: PersonaAtendidaDto
  /** Instante UTC (ISO). */
  inicio: string
  fecha: string
  hora: string
  horaFin: string
  estado: EstadoCitaMedica
  /** Estado con los derivados del reloj (`EN_CURSO`, `SIN_REGISTRAR`). */
  estadoVista: EstadoCitaMedicaDerivado
  consultaId: string | null
  /** Cita nueva que se creó al reprogramar esta inasistencia. */
  reprogramadaA: { id: string; fecha: string; hora: string } | null
  /** Inasistencia sin reprogramar cuya paciente no tiene otra cita futura. */
  puedeReprogramar: boolean
}

/** Un día de la tira de la semana. */
export interface DiaSemanaAgendaMedicaDto {
  fecha: string
  total: number
  /** Hay al menos una cita sin registrar ese día (punto ámbar). */
  conSinRegistrar: boolean
}

/** `GET /medica/agenda?semana=` — lunes a viernes. */
export interface SemanaAgendaMedicaDto {
  lunes: string
  dias: DiaSemanaAgendaMedicaDto[]
}

export interface SinProximaConsultaDto {
  usuariaId: string
  expedienteId: string
  atencionId: string
  codigoAtencion: string
  usuariaNombreCompleto: string
  /** Fecha de calendario de la última consulta de la atención, o null si aún no tiene. */
  ultimaConsulta: string | null
}

/** `GET /medica/agenda/dia?fecha=` — citas del día y los tres paneles laterales. */
export interface DiaAgendaMedicaDto {
  fecha: string
  citas: CitaAgendaMedicaDto[]
  sinProxima: SinProximaConsultaDto[]
}

/**
 * `GET /medica/consultas/por-atender` — lo que la médica tiene que atender o registrar.
 * `hoy` va en curso primero; `atrasadas` son citas de días anteriores que siguen sin registrar.
 */
export interface PorAtenderMedicaDto {
  hoy: CitaAgendaMedicaDto[]
  atrasadas: CitaAgendaMedicaDto[]
}

/** Contadores del menú lateral. */
export interface ContadoresMedicaDto {
  /** Referencias pendientes de primera consulta. */
  areaAtencion: number
  /** Lo de "Por atender" en Consultas: citas de hoy pendientes más las atrasadas sin registrar. */
  consultasPorAtender: number
}

/**
 * Paciente a la que se puede programar una consulta (`ModalProgramar`). Sin atención activa,
 * programar abre `codigoNuevaAtencion`.
 */
export interface PacienteProgramableDto {
  usuariaId: string
  usuariaNombreCompleto: string
  expedienteId: string
  expedienteNumero: string
  /** Referencia pendiente que se atiende al abrir la atención; null si ya hay atención activa. */
  referidoId: string | null
  atencionActiva: { id: string; codigo: string } | null
  codigoNuevaAtencion: string | null
  /** Motivo de la referencia, solo para la primera consulta. */
  motivoReferencia: string | null
  personas: PersonaAtendidaDto[]
}

/** Respuesta de programar o reprogramar. */
export interface CitaMedicaProgramadaDto {
  citaId: string
  atencionId: string
  codigoAtencion: string
  /** Se abrió una atención nueva con esta cita. */
  atencionAbierta: boolean
  fecha: string
  hora: string
}

/** Respuesta de `POST /medica/citas/:id/inasistencia`. */
export interface InasistenciaRegistradaDto {
  citaId: string
  nuevaCita: CitaMedicaProgramadaDto | null
}

/** Fila del listado de Pacientes. */
export interface PacienteMedicaFilaDto {
  usuariaId: string
  nombreCompleto: string
  dpi: string | null
  edad: number
  hijos: number
  expedienteNumero: string
  situacion: FiltroPacientesMedica
  consultas: number
  ultimaConsulta: string | null
  proximaCita: { fecha: string; hora: string } | null
}

export interface PacientesMedicaPaginaDto {
  items: PacienteMedicaFilaDto[]
  siguienteCursor: string | null
  conteos: Record<FiltroPacientesMedica | 'TODAS', number>
}

export interface AtencionMedicaResumenDto {
  id: string
  codigo: string
  estado: EstadoAtencionMedica
  expedienteId: string
  expedienteNumero: string
  fechaInicio: string
  fechaAlta: string | null
  motivoAlta: MotivoAltaMedica | null
  consultas: number
}

/** Cita resumida (ficha y alertas). */
export interface CitaMedicaBreveDto {
  id: string
  version: number
  fecha: string
  hora: string
  persona: PersonaAtendidaDto
}

/** Etapa y fechas del proceso psicológico, si Psicología lo compartió con Medicina (§6.4). */
export interface VistaPsicologicaParaMedicaDto {
  codigo: string
  etapa: string
  fechaInicio: string
  sesiones: string[]
}

/** `GET /medica/pacientes/:usuariaId` — encabezado y pestaña Resumen de la ficha. */
export interface FichaPacienteMedicaDto {
  usuariaId: string
  nombreCompleto: string
  dpi: string | null
  edad: number
  fechaNacimiento: string
  grupoEtnico: string
  municipio: string | null
  telefono: string | null
  direccion: string | null
  /** Instante del último cambio de Trabajo Social a la usuaria o al expediente de trabajo (§6.1). */
  actualizadoPorTsEn: string
  situacion: FiltroPacientesMedica
  /** Expediente con el que trabaja Medicina ahora (el de la atención activa o la referencia pendiente). */
  expedienteId: string
  expedienteNumero: string
  personas: PersonaAtendidaDto[]
  atencionActiva:
    | (AtencionMedicaResumenDto & {
        version: number
        visibleJuridico: boolean
        visiblePsicologia: boolean
        motivoReferencia: string | null
      })
    | null
  pendiente: { referidoId: string; expedienteId: string; expedienteNumero: string; referidoEn: string; motivo: string | null } | null
  atenciones: AtencionMedicaResumenDto[]
  ultimaConsulta: { id: string; fecha: string; hora: string; diagnostico: string } | null
  proximaCita: CitaMedicaBreveDto | null
  citaSinRegistrar: CitaMedicaBreveDto | null
  /** Últimas dos tomas de la usuaria (no de sus hijos/as). */
  signosVitales: { fecha: string; hora: string; actual: SignosVitalesDto; anterior: SignosVitalesDto | null } | null
  totalConsultas: number
  totalDocumentos: number
  psicologia: VistaPsicologicaParaMedicaDto | null
}

export interface DocumentoMedicoDto {
  id: string
  consultaId: string
  tipo: TipoDocumentoMedico
  nombreVisible: string
  nombreArchivo: string
  mimeType: string
  tamanioBytes: number
  createdAt: string
  fechaConsulta: string
  personaNombre: string
}

/** Una consulta completa. Solo para Medicina (§8.3). */
export interface ConsultaMedicaDto {
  id: string
  atencionId: string
  codigoAtencion: string
  citaId: string | null
  fechaHora: string
  fecha: string
  hora: string
  persona: PersonaAtendidaDto
  motivoConsulta: string | null
  diagnostico: string
  planTratamiento: string | null
  recetaLaboratorios: string | null
  signos: SignosVitalesDto
  documentos: DocumentoMedicoDto[]
}

export interface ConsultasMedicasPaginaDto {
  items: ConsultaMedicaDto[]
  siguienteCursor: string | null
}

/**
 * Fila del historial de consultas. Solo metadatos, nunca contenido clínico: el diagnóstico y el
 * resto se piden con `GET /medica/consultas/:id`, que deja constancia en la auditoría.
 */
export interface ConsultaHistorialMedicaDto {
  id: string
  fecha: string
  hora: string
  usuariaId: string
  usuariaNombreCompleto: string
  persona: PersonaAtendidaDto
  codigoAtencion: string
  conCita: boolean
  totalDocumentos: number
}

export interface HistorialConsultasMedicaPaginaDto {
  items: ConsultaHistorialMedicaDto[]
  siguienteCursor: string | null
}

/** Persona que se puede atender en el formulario de consulta. */
export interface PersonaConsultaMedicaDto extends PersonaAtendidaDto {
  fechaNacimiento: string
  /** Talla de la última consulta de esa persona, para precargarla. */
  ultimaTallaM: number | null
  consultasAnteriores: number
}

/** `GET /medica/consultas/contexto` — ficha de solo lectura y datos para el formulario. */
export interface ContextoConsultaMedicaDto {
  atencionId: string
  codigoAtencion: string
  expedienteId: string
  expedienteNumero: string
  usuariaId: string
  usuariaNombreCompleto: string
  telefono: string | null
  procedencia: string | null
  cita: { id: string; fecha: string; hora: string; ninoId: string | null } | null
  personas: PersonaConsultaMedicaDto[]
}

/** Respuesta de `POST /medica/consultas`. */
export interface ConsultaMedicaRegistradaDto {
  consultaId: string
  usuariaId: string
  personaNombre: string
  proximaCita: CitaMedicaProgramadaDto | null
}

/** Respuesta de subir un documento (pendiente o a una consulta). Nunca incluye la clave del objeto. */
export interface DocumentoMedicoSubidoDto {
  id: string
  tipo: TipoDocumentoMedico
  nombreVisible: string
  nombreArchivo: string
  tamanioBytes: number
}

export interface AltaAtencionMedicaRegistradaDto {
  atencionId: string
  citasCanceladas: number
}

export interface VisibilidadAtencionMedicaDto {
  version: number
  visibleJuridico: boolean
  visiblePsicologia: boolean
}

// ---- Reportes ----

/** Desgloses de un periodo: cuentan personas atendidas distintas (usuarias e hijos/as). */
export interface DesglosesMedica {
  rangoEdad: ConteoReporte[]
  grupoEtnico: ConteoReporte[]
  tipologia: ConteoReporte[]
  municipio: ConteoReporte[]
}

export interface PeriodoMedica {
  consultas: number
  personasAtendidas: number
  primerasConsultas: number
  desgloses: DesglosesMedica
}

/** `GET /medica/reportes?anio=` — solo cifras, nunca datos de una persona. */
export interface IndicadoresMedica {
  anio: number
  aniosDisponibles: number[]
  enAtencionAhora: number
  anual: PeriodoMedica
  /** Los 12 meses, de enero a diciembre. */
  meses: PeriodoMedica[]
}

// ---- Lo que Medicina comparte con otras áreas (un DTO por consumidor, §8.3) ----

/** Para Trabajo Social: nunca diagnóstico, plan, receta ni documentos. */
export interface ResumenMedicoParaTs {
  codigo: string
  estado: EstadoAtencionMedica
  fechasConsulta: string[]
  proximaConsulta: string | null
  signosVitales: { fecha: string; valores: SignosVitalesDto } | null
}

/** Para Jurídico, si Medicina lo comparte: fechas de consulta y constancias. */
export interface VistaMedicaParaJuridico {
  codigo: string
  estado: EstadoAtencionMedica
  fechasConsulta: string[]
  constancias: { id: string; nombreVisible: string; fecha: string; mimeType: string }[]
}

/** Para Psicología, si Medicina lo comparte: solo fechas de consulta. */
export interface VistaMedicaParaPsicologia {
  codigo: string
  estado: EstadoAtencionMedica
  fechasConsulta: string[]
}
