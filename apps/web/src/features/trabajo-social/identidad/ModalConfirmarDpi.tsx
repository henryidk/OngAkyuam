import { useEffect, useState } from 'react'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { buscarUsuariaPorDpi } from '../api/trabajoSocial.api'

interface ModalConfirmarDpiProps {
  usuariaId: string
  dpiAnterior: string | null
  dpiNuevo: string
  cargando: boolean
  onConfirmar: () => void
  onVolver: () => void
}

type Verificacion =
  | { estado: 'verificando' }
  | { estado: 'libre' }
  | { estado: 'duplicado'; otra: UsuariaResumenBusqueda }
  | { estado: 'sin-verificar' }

/** Se monta al pedir la confirmación: busca si el DPI nuevo ya pertenece a otra usuaria. */
export default function ModalConfirmarDpi({
  usuariaId,
  dpiAnterior,
  dpiNuevo,
  cargando,
  onConfirmar,
  onVolver,
}: ModalConfirmarDpiProps) {
  // Sin DPI nuevo (menor de edad) no hay nada que pueda duplicarse.
  const [verificacion, setVerificacion] = useState<Verificacion>(
    dpiNuevo === '' ? { estado: 'libre' } : { estado: 'verificando' },
  )

  useEffect(() => {
    if (dpiNuevo === '') return
    let cancelado = false
    buscarUsuariaPorDpi(dpiNuevo)
      .then((encontradas) => {
        if (cancelado) return
        const otra = encontradas.find((encontrada) => encontrada.id !== usuariaId)
        setVerificacion(otra ? { estado: 'duplicado', otra } : { estado: 'libre' })
      })
      .catch(() => {
        // Si la búsqueda falla, el servidor igual rechaza un DPI repetido al guardar.
        if (!cancelado) setVerificacion({ estado: 'sin-verificar' })
      })
    return () => {
      cancelado = true
    }
  }, [dpiNuevo, usuariaId])

  return (
    <ConfirmModal
      abierto
      titulo="¿Cambiar el DPI?"
      descripcion="El DPI es el dato que evita expedientes duplicados. Verifica contra el documento físico antes de confirmar."
      confirmarLabel="Sí, cambiar DPI"
      cancelarLabel="Volver"
      cargando={cargando}
      confirmarDeshabilitado={verificacion.estado === 'verificando' || verificacion.estado === 'duplicado'}
      onConfirmar={onConfirmar}
      onCancelar={onVolver}
    >
      <dl className="grid grid-cols-[80px_1fr] gap-y-1.5 rounded-lg bg-gray-50 px-3.5 py-3 text-sm">
        <dt className="text-gray-500">Anterior</dt>
        <dd className="tabular-nums text-gray-500 line-through">{dpiAnterior || '—'}</dd>
        <dt className="text-gray-500">Nuevo</dt>
        <dd className="font-semibold tabular-nums text-gray-900">{dpiNuevo || 'Sin DPI'}</dd>
      </dl>
      <div role="status" className="text-xs">
        {verificacion.estado === 'verificando' && <p className="text-gray-500">Verificando que no esté registrado…</p>}
        {verificacion.estado === 'libre' && dpiNuevo !== '' && (
          <p className="text-green-700">No existe otra usuaria con este DPI.</p>
        )}
        {verificacion.estado === 'sin-verificar' && (
          <p className="text-gray-500">No se pudo verificar ahora; el sistema lo comprobará al guardar.</p>
        )}
        {verificacion.estado === 'duplicado' && (
          <p className="text-red-600">
            Este DPI ya pertenece a otra usuaria.{' '}
            <a
              href={`/trabajo-social/usuarias/${verificacion.otra.id}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Ver su ficha (se abre en otra pestaña)
            </a>
          </p>
        )}
      </div>
    </ConfirmModal>
  )
}
