import { useState } from 'react'
import { ETIQUETAS_GRUPO_ETNICO, ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ, formatFechaGT, type UsuariaExpedienteHub } from '@akyuam/shared'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import FormularioIdentidadUsuaria from './FormularioIdentidadUsuaria'

interface ResumenIdentidadUsuariaProps {
  usuaria: UsuariaExpedienteHub
  onActualizado: (usuaria: UsuariaExpedienteHub) => void
}

function ubicacion(usuaria: UsuariaExpedienteHub): string {
  if (usuaria.municipio) {
    return ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[usuaria.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ]
  }
  if (usuaria.municipioOtro) {
    return `${usuaria.municipioOtro}, ${usuaria.departamentoOtro ?? ''}`.trim()
  }
  return '—'
}

/** Tarjeta de identidad de solo lectura + edición explícita — usada por el wizard al registrar un caso para una usuaria existente. */
export default function ResumenIdentidadUsuaria({ usuaria, onActualizado }: ResumenIdentidadUsuariaProps) {
  const [editando, setEditando] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {usuaria.nombres} {usuaria.apellidos}
          </p>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 sm:grid-cols-3">
            <div>DPI: {usuaria.dpi ?? '—'}</div>
            <div>Teléfono: {usuaria.telefono ?? '—'}</div>
            <div>Nacimiento: {formatFechaGT(usuaria.fechaNacimiento)}</div>
            <div>Grupo étnico: {ETIQUETAS_GRUPO_ETNICO[usuaria.grupoEtnico as keyof typeof ETIQUETAS_GRUPO_ETNICO] ?? usuaria.grupoEtnico}</div>
            <div>Municipio: {ubicacion(usuaria)}</div>
            <div>Dirección: {usuaria.direccion ?? '—'}</div>
          </dl>
        </div>
        <Button variante="secondary" onClick={() => setEditando(true)}>
          Editar datos
        </Button>
      </div>

      <Drawer abierto={editando} titulo="Editar datos de la usuaria" onCerrar={() => setEditando(false)}>
        <FormularioIdentidadUsuaria
          usuaria={usuaria}
          onGuardado={(actualizado) => {
            onActualizado(actualizado)
            setEditando(false)
          }}
          onCancelar={() => setEditando(false)}
        />
      </Drawer>
    </div>
  )
}
