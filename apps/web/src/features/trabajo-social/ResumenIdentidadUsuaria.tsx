import { useCallback, useState } from 'react'
import { formatFechaGT, type UsuariaExpedienteHub } from '@akyuam/shared'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { textoGrupoEtnico, textoUbicacion } from './ficha/textoUsuaria'
import EdicionIdentidadUsuaria from './identidad/EdicionIdentidadUsuaria'

interface ResumenIdentidadUsuariaProps {
  usuaria: UsuariaExpedienteHub
  onActualizado: (usuaria: UsuariaExpedienteHub) => void
}

/**
 * Tarjeta de identidad de solo lectura + edición en línea — usada por el wizard al registrar un
 * caso para una usuaria existente. Guardar no avanza ni reinicia el wizard: solo vuelve al resumen.
 */
export default function ResumenIdentidadUsuaria({ usuaria, onActualizado }: ResumenIdentidadUsuariaProps) {
  const [editando, setEditando] = useState(false)
  const { mostrar } = useToast()

  const salirDeEdicion = useCallback(() => setEditando(false), [])
  const onGuardado = useCallback(
    (actualizada: UsuariaExpedienteHub) => {
      onActualizado(actualizada)
      setEditando(false)
      mostrar('Datos actualizados · ya se ven en las áreas y en el reporte')
    },
    [onActualizado, mostrar],
  )

  if (editando) {
    return (
      <div className="rounded-xl border-2 border-brand-600 bg-white p-4 ring-4 ring-brand-50">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-900">Editando datos de la usuaria</p>
          <span className="text-xs text-gray-500">Esc para cancelar</span>
        </div>
        <EdicionIdentidadUsuaria
          usuaria={usuaria}
          disposicion="compacta"
          onGuardado={onGuardado}
          onSalir={salirDeEdicion}
          clasePie="-mx-4 -mb-4 mt-4 rounded-b-xl px-4"
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {usuaria.nombres} {usuaria.apellidos}
          </p>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 sm:grid-cols-3">
            <div>DPI: {usuaria.dpi || '—'}</div>
            <div>Teléfono: {usuaria.telefono || '—'}</div>
            <div>Nacimiento: {formatFechaGT(usuaria.fechaNacimiento)}</div>
            <div>Grupo étnico: {textoGrupoEtnico(usuaria.grupoEtnico)}</div>
            <div>Municipio: {textoUbicacion(usuaria) ?? '—'}</div>
            <div>Dirección: {usuaria.direccion || '—'}</div>
          </dl>
        </div>
        <Button type="button" variante="secondary" onClick={() => setEditando(true)}>
          Editar datos
        </Button>
      </div>
    </div>
  )
}
