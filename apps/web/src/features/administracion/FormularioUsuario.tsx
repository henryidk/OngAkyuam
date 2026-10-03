import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  ETIQUETAS_PUESTO,
  ETIQUETAS_ROL_CON_LOGIN,
  PUESTOS_POR_AREA,
  ROLES_CON_LOGIN_ADMINISTRABLES,
  type CrearUsuarioInput,
  type CrearUsuarioResultado,
  type EditarUsuarioInput,
  type RolConLogin,
  type UsuarioAdminDto,
} from '@akyuam/shared'
import SelectInput from '../../components/form/SelectInput'
import TextoInput from '../../components/form/TextoInput'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface FormularioUsuarioProps {
  /** Presente al editar; ausente al crear. */
  usuario?: UsuarioAdminDto
  onCreado: (resultado: CrearUsuarioResultado) => void
  onEditado: (usuario: UsuarioAdminDto) => void
  onCancelar: () => void
}

const OPCIONES_ROL = ROLES_CON_LOGIN_ADMINISTRABLES.map((rol) => ({
  value: rol,
  label: ETIQUETAS_ROL_CON_LOGIN[rol],
}))

function opcionesPuesto(rol: RolConLogin | '') {
  if (!rol || rol === 'ADMINISTRACION') return []
  return PUESTOS_POR_AREA[rol].map((puesto) => ({
    value: puesto,
    label: ETIQUETAS_PUESTO[puesto] ?? puesto,
  }))
}

export default function FormularioUsuario({
  usuario,
  onCreado,
  onEditado,
  onCancelar,
}: FormularioUsuarioProps) {
  if (usuario) {
    return <FormularioEditar usuario={usuario} onEditado={onEditado} onCancelar={onCancelar} />
  }
  return <FormularioCrear onCreado={onCreado} onCancelar={onCancelar} />
}

function FormularioCrear({
  onCreado,
  onCancelar,
}: {
  onCreado: (resultado: CrearUsuarioResultado) => void
  onCancelar: () => void
}) {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CrearUsuarioInput>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: {
      nombreCompleto: '',
      telefono: '',
      dpi: '',
      username: '',
      rol: undefined,
      puesto: undefined,
    },
  })

  const rolSeleccionado = watch('rol')

  async function onSubmit(datos: CrearUsuarioInput) {
    setErrorEnvio(null)
    try {
      const { data } = await api.post<CrearUsuarioResultado>('/administracion/usuarios', datos)
      onCreado(data)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TextoInput
        label="Nombre completo"
        registro={register('nombreCompleto')}
        error={errors.nombreCompleto?.message}
      />
      <TextoInput
        label="Teléfono"
        inputMode="numeric"
        maxLength={8}
        registro={register('telefono')}
        error={errors.telefono?.message}
        ayuda="8 dígitos"
      />
      <TextoInput
        label="DPI"
        registro={register('dpi')}
        error={errors.dpi?.message}
        ayuda="13 dígitos"
      />
      <TextoInput
        label="Nombre de usuario"
        registro={register('username')}
        error={errors.username?.message}
      />
      <SelectInput
        label="Área"
        registro={register('rol')}
        opciones={OPCIONES_ROL}
        placeholder="Seleccionar…"
        error={errors.rol?.message}
      />
      {rolSeleccionado && rolSeleccionado !== 'ADMINISTRACION' && (
        <SelectInput
          label="Puesto"
          registro={register('puesto')}
          opciones={opcionesPuesto(rolSeleccionado)}
          placeholder="Seleccionar…"
          error={errors.puesto?.message}
        />
      )}

      {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variante="secondary" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" cargando={isSubmitting}>
          Crear usuario
        </Button>
      </div>
    </form>
  )
}

function FormularioEditar({
  usuario,
  onEditado,
  onCancelar,
}: {
  usuario: UsuarioAdminDto
  onEditado: (usuario: UsuarioAdminDto) => void
  onCancelar: () => void
}) {
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditarUsuarioInput>({
    resolver: zodResolver(editarUsuarioSchema),
    defaultValues: {
      nombreCompleto: usuario.nombreCompleto,
      telefono: usuario.telefono ?? '',
      dpi: usuario.dpi ?? '',
      username: usuario.username,
    },
  })

  async function onSubmit(datos: EditarUsuarioInput) {
    setErrorEnvio(null)
    try {
      const { data } = await api.patch<UsuarioAdminDto>(
        `/administracion/usuarios/${usuario.id}`,
        datos,
      )
      onEditado(data)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Área: <span className="font-medium text-gray-700">{ETIQUETAS_ROL_CON_LOGIN[usuario.rol]}</span>
        {usuario.puesto && (
          <>
            {' · '}Puesto:{' '}
            <span className="font-medium text-gray-700">
              {ETIQUETAS_PUESTO[usuario.puesto] ?? usuario.puesto}
            </span>
          </>
        )}
        <p className="mt-1">No se pueden cambiar aquí — desactiva esta cuenta y crea una nueva si cambió de área o puesto.</p>
      </div>

      <TextoInput
        label="Nombre completo"
        registro={register('nombreCompleto')}
        error={errors.nombreCompleto?.message}
      />
      <TextoInput
        label="Teléfono"
        inputMode="numeric"
        maxLength={8}
        registro={register('telefono')}
        error={errors.telefono?.message}
        ayuda="8 dígitos"
      />
      <TextoInput
        label="DPI"
        registro={register('dpi')}
        error={errors.dpi?.message}
        ayuda="13 dígitos"
      />
      <TextoInput
        label="Nombre de usuario"
        registro={register('username')}
        error={errors.username?.message}
      />

      {errorEnvio && <p className="text-sm text-red-600">{errorEnvio}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variante="secondary" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" cargando={isSubmitting}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}
