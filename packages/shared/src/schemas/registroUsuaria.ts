import { z } from 'zod'
import { edadEnAniosGT } from '../timezone.js'
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
 * `municipio` guarda un valor de `MUNICIPIOS_ALTA_VERAPAZ` mientras `fueraDeAltaVerapaz` sea `false`;
 * cuando la usuaria es de fuera de la región, se usan `departamentoOtro`/`municipioOtro` en su lugar.
 * Todo queda como `string`/`boolean` planos (nunca `.optional()`) por la misma razón que el resto de
 * este archivo: el resolver de react-hook-form necesita que el tipo de entrada y salida coincidan.
 */
export const datosCasoSchema = z
  .object({
    fecha: fechaCalendarioSchema,
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

export const datosUsuariaSchema = z.object({
  nombres: z.string().min(1, 'Requerido'),
  apellidos: z.string().min(1, 'Requerido'),
  dpi: dpiSchema,
  telefono: telefonoSchema,
  direccion: textoOpcionalSchema,
  fechaNacimiento: fechaCalendarioSchema,
  grupoEtnico: grupoEtnicoSchema,
  tipologiaDelito: z.array(tipologiaDelitoSchema).min(1, 'Selecciona al menos una tipología'),
})

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

export const registroUsuariaSchema = z
  .object({
    datosCaso: datosCasoSchema,
    datosUsuaria: datosUsuariaSchema,
    datosAgresor: datosAgresorSchema,
    tipoRegistro: tipoRegistroSchema,
    ninos: z.array(ninoSchema),
    // Referir es opcional: trabajo social puede no saber todavía a qué área corresponde.
    areasReferidas: z.array(areaAtencionSchema),
  })
  .refine((datos) => datos.tipoRegistro === 'INTERNA' || datos.ninos.length === 0, {
    message: 'Solo se registran niñas y niños cuando la usuaria es Interna (solicita albergue)',
    path: ['ninos'],
  })

export type DatosCaso = z.infer<typeof datosCasoSchema>
export type DatosUsuaria = z.infer<typeof datosUsuariaSchema>
export type DatosAgresor = z.infer<typeof datosAgresorSchema>
export type Nino = z.infer<typeof ninoSchema>
export type TipoRegistro = z.infer<typeof tipoRegistroSchema>
export type AreaAtencion = z.infer<typeof areaAtencionSchema>
export type RegistroUsuariaFormValues = z.infer<typeof registroUsuariaSchema>

/**
 * Mismo schema que valida el formulario en el navegador, reutilizado tal cual como el contrato
 * del body de `POST /trabajo-social/expedientes` — evita que frontend y backend se desincronicen
 * cuando el formulario cambie (ver CLAUDE.md, "Validación compartida").
 */
export const crearExpedienteSchema = registroUsuariaSchema
export type CrearExpedienteInput = RegistroUsuariaFormValues

export interface ExpedienteCreado {
  id: string
  numero: string
  usuariaId: string
  usuariaNombreCompleto: string
  fecha: string
  municipio: string | null
  tipoRegistro: TipoRegistro
}
