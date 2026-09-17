import { z } from 'zod'
import { PUESTOS_POR_AREA, ROLES_CON_LOGIN_ADMINISTRABLES } from '../catalogos/administracion.js'

export const rolConLoginSchema = z.enum(ROLES_CON_LOGIN_ADMINISTRABLES)
export type RolConLogin = z.infer<typeof rolConLoginSchema>

const camposBaseUsuario = {
  nombreCompleto: z.string().min(1, 'Requerido'),
  telefono: z.string().regex(/^\d{8}$/, 'Teléfono inválido — debe tener 8 dígitos'),
  dpi: z.string().regex(/^\d{13}$/, 'DPI inválido — debe tener 13 dígitos'),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo'),
}

/**
 * `puesto` es obligatorio y debe pertenecer al catálogo de la propia área para las 4 áreas
 * de atención; ADMINISTRACION no atiende casos, así que no tiene puesto y se rechaza si
 * alguien lo manda igual (evita datos basura silenciosos, no solo "se ignora").
 */
export const crearUsuarioSchema = z
  .object({
    ...camposBaseUsuario,
    rol: rolConLoginSchema,
    puesto: z.string().optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.rol === 'ADMINISTRACION') {
      if (datos.puesto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['puesto'],
          message: 'Administración no tiene puesto',
        })
      }
      return
    }

    const puestosValidos = PUESTOS_POR_AREA[datos.rol]
    if (!datos.puesto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['puesto'],
        message: 'Requerido para esta área',
      })
    } else if (!puestosValidos.includes(datos.puesto)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['puesto'],
        message: `Puesto inválido para esta área — valores permitidos: ${puestosValidos.join(', ')}`,
      })
    }
  })
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>

/**
 * Área y puesto quedan fijos tras la creación (mismo criterio que `editarPersonalSchema`,
 * que tampoco permite cambiar `area`/`tipo`). Si el puesto o el área cambian en la vida
 * real, se desactiva la cuenta y se crea una nueva.
 */
export const editarUsuarioSchema = z.object(camposBaseUsuario)
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>

export const listarUsuariosQuerySchema = z.object({
  rol: rolConLoginSchema.optional(),
})
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>

export interface UsuarioAdminDto {
  id: string
  nombreCompleto: string
  username: string
  telefono: string | null
  dpi: string | null
  rol: RolConLogin
  puesto: string | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}

export interface CrearUsuarioResultado {
  usuario: UsuarioAdminDto
  passwordTemporal: string
}
