import { z } from 'zod'
import { edadEnAniosGT } from '../timezone.js'
import type { TipoDocumento } from './documentos.js'
import type { EstadoCasoTs, EstadoTs } from './trabajoSocial.js'
import {
  AREAS_ATENCION,
  DEPARTAMENTOS_GUATEMALA,
  EDAD_MAXIMA_NINOS,
  GENEROS,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  TIPOLOGIAS_DELITO,
  TIPOS_REGISTRO,
} from '../catalogos/registroUsuaria.js'

/** Departamentos distintos de Alta Verapaz, para cuando la usuaria viene de fuera de la región atendida. */
export const DEPARTAMENTOS_FUERA_ALTA_VERAPAZ = DEPARTAMENTOS_GUATEMALA.filter(
  (departamento) => departamento !== 'Alta Verapaz',
)

/** "YYYY-MM-DD" — fecha de calendario pura, nunca envuelta en un objeto Date salvo para calcularla. */
const fechaCalendarioSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/**
 * Campos de texto opcionales: "" significa "no se capturó" — se valida así en vez de usar
 * `.optional()`/`.transform()` para que el tipo de entrada y de salida del schema sean
 * exactamente el mismo (`string`), que es lo que espera el resolver de react-hook-form.
 */
const dpiSchema = z.string().refine((valor) => valor === '' || /^\d{13}$/.test(valor), 'El DPI debe tener 13 dígitos')

const telefonoSchema = z.string().refine((valor) => valor === '' || valor.length >= 8, 'Teléfono inválido')

const textoOpcionalSchema = z.string()

const REQUERIDO = 'Selecciona una opción'

export const grupoEtnicoSchema = z.enum(GRUPOS_ETNICOS, REQUERIDO)
export const tipologiaDelitoSchema = z.enum(TIPOLOGIAS_DELITO)
export const generoSchema = z.enum(GENEROS, REQUERIDO)
export const tipoRegistroSchema = z.enum(TIPOS_REGISTRO, REQUERIDO)
export const areaAtencionSchema = z.enum(AREAS_ATENCION)

/**
 * Identidad de la usuaria — se captura una vez y se reutiliza en todos sus casos (expedientes).
 * Incluye dónde vive (`municipio`/`ubicacionGeografica`/`departamentoOtro`/`municipioOtro`):
 * son datos de la persona, no del caso puntual, así que nunca se vuelven a pedir al registrar
 * un caso nuevo de una usuaria ya existente — solo se editan explícitamente si cambian, vía
 * `editarIdentidadUsuariaSchema` (mismo shape, reusado tal cual).
 * `municipio` guarda un valor de `MUNICIPIOS_ALTA_VERAPAZ` mientras `fueraDeAltaVerapaz` sea `false`;
 * cuando la usuaria es de fuera de la región, se usan `departamentoOtro`/`municipioOtro` en su lugar.
 * Todo queda como `string`/`boolean` planos (nunca `.optional()`) por la misma razón que el resto de
 * este archivo: el resolver de react-hook-form necesita que el tipo de entrada y salida coincidan.
 */
export const identidadUsuariaSchema = z
  .object({
    nombres: z.string().min(1, 'Requerido'),
    apellidos: z.string().min(1, 'Requerido'),
    dpi: dpiSchema,
    telefono: telefonoSchema,
    direccion: textoOpcionalSchema,
    fechaNacimiento: fechaCalendarioSchema,
    grupoEtnico: grupoEtnicoSchema,
    fueraDeAltaVerapaz: z.boolean(),
    municipio: z.string(),
    departamentoOtro: z.string(),
    municipioOtro: z.string(),
    ubicacionGeografica: z.string().min(1, 'Requerido'),
  })
  .refine(
    (datos) =>
      datos.fueraDeAltaVerapaz
        ? datos.departamentoOtro !== '' && datos.municipioOtro !== ''
        : (MUNICIPIOS_ALTA_VERAPAZ as readonly string[]).includes(datos.municipio),
    {
      message: 'Selecciona un municipio de Alta Verapaz, o indica el departamento y municipio de origen',
      path: ['municipio'],
    },
  )

/** Editar identidad reusa exactamente el mismo shape — mismo contrato para crear y para el PATCH. */
export const editarIdentidadUsuariaSchema = identidadUsuariaSchema

export const datosAgresorSchema = z.object({
  nombres: textoOpcionalSchema,
  apellidos: textoOpcionalSchema,
  telefono: telefonoSchema,
  direccion: textoOpcionalSchema,
})

const fechaNacimientoNinoSchema = fechaCalendarioSchema.refine(
  (iso) => edadEnAniosGT(iso) < EDAD_MAXIMA_NINOS,
  `Debe ser menor de ${EDAD_MAXIMA_NINOS} años`,
)

export const ninoSchema = z.object({
  nombres: z.string().min(1, 'Requerido'),
  apellidos: z.string().min(1, 'Requerido'),
  fechaNacimiento: fechaNacimientoNinoSchema,
  genero: generoSchema,
})

export const OBSERVACIONES_CASO_MAX = 2000

/**
 * Todo lo que puede variar de un caso a otro de la misma usuaria: la tipología del delito, si
 * pide albergue (y desde cuándo), quién es el agresor (puede ser otra persona en cada caso), las
 * observaciones de la entrevista y los niños que la acompañan en ese caso puntual. Es el body
 * completo de "nuevo caso" para una usuaria ya existente (`nuevoCasoSchema` = este schema, sin
 * más), y la mitad de `registroUsuariaNuevaSchema` cuando la usuaria es nueva.
 * Referir a un área ya no es parte del registro: se hace después, desde la ficha del caso
 * (`referirSchema`), para elegir profesional, prioridad y visibilidad en el mismo paso.
 */
export const datosCasoSchema = z
  .object({
    fecha: fechaCalendarioSchema,
    tipologiaDelito: z.array(tipologiaDelitoSchema).min(1, 'Selecciona al menos una tipología'),
    tipoRegistro: tipoRegistroSchema,
    // "" mientras sea Externa — mismo criterio de strings planos que el resto del archivo.
    fechaIngresoAlbergue: z.string(),
    datosAgresor: datosAgresorSchema,
    observaciones: z.string().trim().max(OBSERVACIONES_CASO_MAX, `Máximo ${OBSERVACIONES_CASO_MAX} caracteres`),
    ninos: z.array(ninoSchema),
  })
  .refine(
    (datos) => datos.tipoRegistro !== 'INTERNA' || /^\d{4}-\d{2}-\d{2}$/.test(datos.fechaIngresoAlbergue),
    { message: 'Indica la fecha de ingreso al albergue', path: ['fechaIngresoAlbergue'] },
  )
  .refine((datos) => datos.tipoRegistro === 'INTERNA' || datos.ninos.length === 0, {
    message: 'Solo se registran niñas y niños cuando la usuaria es Interna (solicita albergue)',
    path: ['ninos'],
  })

/** Para una usuaria nueva: identidad completa + su primer caso, en un solo submit. */
export const registroUsuariaNuevaSchema = z.object({
  datosUsuaria: identidadUsuariaSchema,
  datosCaso: datosCasoSchema,
})

/** Para una usuaria ya existente: solo el caso nuevo — nunca vuelve a pedir identidad. */
export const nuevoCasoSchema = datosCasoSchema

/** Query de `GET /trabajo-social/usuarias/buscar` — el mínimo de 3 caracteres para `nombre` y la
 * exigencia de que venga uno de los dos criterios se valida en el service (defensa en
 * profundidad), no aquí: aquí solo se valida la forma de los parámetros de query. */
export const buscarUsuariaQuerySchema = z.object({
  dpi: z.string().optional(),
  nombre: z.string().optional(),
})
export type BuscarUsuariaQuery = z.infer<typeof buscarUsuariaQuerySchema>

export type IdentidadUsuaria = z.infer<typeof identidadUsuariaSchema>
export type DatosCaso = z.infer<typeof datosCasoSchema>
export type DatosAgresor = z.infer<typeof datosAgresorSchema>
export type Nino = z.infer<typeof ninoSchema>
export type TipoRegistro = z.infer<typeof tipoRegistroSchema>
export type AreaAtencion = z.infer<typeof areaAtencionSchema>
export type RegistroUsuariaNuevaFormValues = z.infer<typeof registroUsuariaNuevaSchema>
export type NuevoCasoFormValues = z.infer<typeof nuevoCasoSchema>
export type EditarIdentidadUsuariaInput = z.infer<typeof editarIdentidadUsuariaSchema>

/**
 * Mismo schema que valida el formulario en el navegador, reutilizado tal cual como el contrato
 * del body de `POST /trabajo-social/expedientes` — evita que frontend y backend se desincronicen
 * cuando el formulario cambie (ver CLAUDE.md, "Validación compartida").
 */
export const crearExpedienteSchema = registroUsuariaNuevaSchema
export type CrearExpedienteInput = RegistroUsuariaNuevaFormValues

export interface ExpedienteCreado {
  id: string
  numero: string
  usuariaId: string
  usuariaNombreCompleto: string
  fecha: string
  municipio: string | null
  tipoRegistro: TipoRegistro
}

/** Fila de resultado de búsqueda — lo mínimo para identificar a la usuaria antes de elegirla. */
export interface UsuariaResumenBusqueda {
  id: string
  nombres: string
  apellidos: string
  dpi: string | null
  fechaNacimiento: string
}

/** Un caso dentro del historial de una usuaria — ver GET /trabajo-social/usuarias/:id. */
export interface ExpedienteResumenCaso {
  id: string
  numero: string
  fecha: string
  tipoRegistro: TipoRegistro
  areasReferidas: AreaAtencion[]
  /** Estado derivado de Trabajo Social para este caso (ver `EstadoTsService`). */
  estado: EstadoTs
  enAlbergue: boolean
}

/** Identidad de la usuaria + todos sus casos — el hub de la sección "Expediente". */
export interface UsuariaExpedienteHub {
  id: string
  createdAt: string
  nombres: string
  apellidos: string
  dpi: string | null
  telefono: string | null
  direccion: string | null
  fechaNacimiento: string
  grupoEtnico: string
  municipio: string | null
  departamentoOtro: string | null
  municipioOtro: string | null
  ubicacionGeografica: string | null
  /** Más reciente primero; el primero es el caso activo. */
  casos: ExpedienteResumenCaso[]
  /** Estado del caso activo y de cada área referida en él; `null` si la usuaria no tiene casos. */
  casoActivo: ({ id: string } & EstadoCasoTs) | null
}

/** Detalle de un caso puntual, vista de solo lectura — mismo criterio que `ExpedienteDetalleArea`. */
export interface ExpedienteDetalleCaso {
  id: string
  numero: string
  fecha: string
  tipoRegistro: TipoRegistro
  tipologiaDelito: string[]
  usuariaId: string
  agresor: {
    nombres: string | null
    apellidos: string | null
    telefono: string | null
    direccion: string | null
  } | null
  observaciones: string | null
  fechaIngresoAlbergue: string | null
  fechaEgresoAlbergue: string | null
  ninos: Nino[]
  areasReferidas: AreaAtencion[]
}
