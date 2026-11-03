import { useState, type ReactNode } from 'react'
import { AlertCircle, Info, KeyRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  ETIQUETAS_PUESTO,
  ETIQUETAS_ROL_CON_LOGIN,
  ETIQUETAS_SEDE,
  PUESTOS_POR_AREA,
  ROLES_CON_LOGIN_ADMINISTRABLES,
  SEDES,
  type CrearUsuarioInput,
  type CrearUsuarioResultado,
  type EditarUsuarioInput,
  type RolConLogin,
  type UsuarioAdminDto,
} from '@akyuam/shared'
import SelectInput from '../../components/form/SelectInput'
import TextoInput from '../../components/form/TextoInput'
import Button from '../../components/ui/Button'
import { CuerpoModal, PieModal } from '../../components/ui/Modal'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import { useFichasPersonalLibres, usaFichaPersonal } from './useFichasPersonalLibres'

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

const OPCIONES_SEDE = SEDES.map((sede) => ({ value: sede, label: ETIQUETAS_SEDE[sede] }))

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
      sede: undefined,
      rol: undefined,
      puesto: undefined,
      personalId: undefined,
    },
  })

  const rolSeleccionado = watch('rol')
  const puestoSeleccionado = watch('puesto')
  const fichas = useFichasPersonalLibres(rolSeleccionado, puestoSeleccionado)

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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <CuerpoModal>
        <div className="space-y-6">
          <Seccion titulo="Datos personales">
            <div className="sm:col-span-2">
              <TextoInput
                label="Nombre completo"
                registro={register('nombreCompleto')}
                error={errors.nombreCompleto?.message}
              />
            </div>
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
              inputMode="numeric"
              maxLength={13}
              registro={register('dpi')}
              error={errors.dpi?.message}
              ayuda="13 dígitos"
            />
          </Seccion>

          <Seccion titulo="Cuenta y área de trabajo">
            <TextoInput
              label="Nombre de usuario"
              autoComplete="off"
              registro={register('username')}
              error={errors.username?.message}
            />
            <SelectInput
              label="Sede"
              registro={register('sede')}
              opciones={OPCIONES_SEDE}
              placeholder="Seleccionar…"
              error={errors.sede?.message}
              ayuda="Será la «Oficina responsable» de los casos que registre."
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
            {usaFichaPersonal(rolSeleccionado) && puestoSeleccionado && (
              <div className="sm:col-span-2">
                <SelectInput
                  label="Ficha de personal"
                  registro={register('personalId', { setValueAs: (valor) => valor || undefined })}
                  opciones={fichas.opciones}
                  placeholder="Crear una ficha nueva"
                  error={errors.personalId?.message ?? fichas.error ?? undefined}
                  ayuda="Elige una ficha si esta persona ya tenía procesos asignados."
                />
              </div>
            )}
          </Seccion>

          <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3.5 py-2.5 text-xs text-brand-800">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Al crear la cuenta se genera una contraseña temporal que la persona deberá cambiar en su
            primer ingreso.
          </p>

          {errorEnvio && <ErrorEnvio mensaje={errorEnvio} />}
        </div>
      </CuerpoModal>

      <PieModal>
        <Button type="button" variante="secondary" tamano="md" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" tamano="md" cargando={isSubmitting}>
          Crear usuario
        </Button>
      </PieModal>
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
  const [personalId, setPersonalId] = useState(usuario.personalId ?? '')
  const conFicha = usaFichaPersonal(usuario.rol)
  const fichas = useFichasPersonalLibres(usuario.rol, usuario.puesto, usuario.id)
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
      sede: usuario.sede,
    },
  })

  async function onSubmit(datos: EditarUsuarioInput) {
    setErrorEnvio(null)
    try {
      let { data } = await api.patch<UsuarioAdminDto>(
        `/administracion/usuarios/${usuario.id}`,
        datos,
      )
      if (conFicha && personalId !== (usuario.personalId ?? '')) {
        ;({ data } = await api.patch<UsuarioAdminDto>(
          `/administracion/usuarios/${usuario.id}/ficha-personal`,
          { personalId: personalId || null },
        ))
      }
      onEditado(data)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <CuerpoModal>
        <div className="space-y-6">
          <div className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs text-gray-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <div>
              <p>
                Área: <span className="font-medium text-gray-800">{ETIQUETAS_ROL_CON_LOGIN[usuario.rol]}</span>
                {usuario.puesto && (
                  <>
                    {' · '}Puesto:{' '}
                    <span className="font-medium text-gray-800">
                      {ETIQUETAS_PUESTO[usuario.puesto] ?? usuario.puesto}
                    </span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-gray-500">
                No se pueden cambiar aquí: si cambió de área o puesto, desactiva esta cuenta y crea una nueva.
              </p>
            </div>
          </div>

          <Seccion titulo="Datos personales">
            <div className="sm:col-span-2">
              <TextoInput
                label="Nombre completo"
                registro={register('nombreCompleto')}
                error={errors.nombreCompleto?.message}
              />
            </div>
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
              inputMode="numeric"
              maxLength={13}
              registro={register('dpi')}
              error={errors.dpi?.message}
              ayuda="13 dígitos"
            />
          </Seccion>

          <Seccion titulo="Cuenta">
            <TextoInput
              label="Nombre de usuario"
              autoComplete="off"
              registro={register('username')}
              error={errors.username?.message}
            />
            <SelectInput
              label="Sede"
              registro={register('sede')}
              opciones={OPCIONES_SEDE}
              placeholder="Seleccionar…"
              error={errors.sede?.message}
              ayuda="Será la «Oficina responsable» de los casos que registre."
            />
            {conFicha && (
              <div className="sm:col-span-2">
                <label htmlFor="personalId" className="block text-sm font-medium text-gray-700">
                  Ficha de personal
                </label>
                <select
                  id="personalId"
                  value={personalId}
                  onChange={(event) => setPersonalId(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Sin ficha</option>
                  {fichas.opciones.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {fichas.error ??
                    'Con la ficha enlazada, esta persona ve sus procesos en "Mis procesos".'}
                </p>
              </div>
            )}
          </Seccion>

          {errorEnvio && <ErrorEnvio mensaje={errorEnvio} />}
        </div>
      </CuerpoModal>

      <PieModal>
        <Button type="button" variante="secondary" tamano="md" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" tamano="md" cargando={isSubmitting}>
          Guardar cambios
        </Button>
      </PieModal>
    </form>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">{titulo}</legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function ErrorEnvio({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {mensaje}
    </div>
  )
}
