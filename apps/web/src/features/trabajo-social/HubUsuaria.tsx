import { ChevronRight, FolderOpen, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ETIQUETAS_AREA_ATENCION, ETIQUETAS_TIPO_REGISTRO, formatFechaGT, type UsuariaExpedienteHub } from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ResumenIdentidadUsuaria from './ResumenIdentidadUsuaria'

interface HubUsuariaProps {
  usuariaId: string
  onVerCaso: (expedienteId: string) => void
  onVolverABuscar: () => void
}

/** Identidad + historial completo de casos de una usuaria — corazón de la sección "Expediente" (exclusiva de Trabajo Social). */
export default function HubUsuaria({ usuariaId, onVerCaso, onVolverABuscar }: HubUsuariaProps) {
  const navigate = useNavigate()
  const [usuaria, setUsuaria] = useState<UsuariaExpedienteHub | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setUsuaria(null)
    setError(null)
    api
      .get<UsuariaExpedienteHub>(`/trabajo-social/usuarias/${usuariaId}`)
      .then(({ data }) => {
        if (!cancelado) setUsuaria(data)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [usuariaId])

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Button variante="secondary" onClick={onVolverABuscar} className="mt-4">
          Volver a buscar
        </Button>
      </div>
    )
  }

  if (!usuaria) {
    return <p className="text-sm text-gray-500">Cargando datos de la usuaria…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button type="button" onClick={onVolverABuscar} className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Buscar otra usuaria
      </button>

      <ResumenIdentidadUsuaria usuaria={usuaria} onActualizado={setUsuaria} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Historial de casos</h3>
          <Button onClick={() => navigate('/trabajo-social/registrar', { state: { usuariaId: usuaria.id } })}>
            <Plus className="h-4 w-4" />
            Registrar nuevo caso
          </Button>
        </div>

        {usuaria.casos.length === 0 ? (
          <EmptyState
            Icono={FolderOpen}
            titulo="Sin casos registrados"
            descripcion="Esta usuaria aún no tiene ningún caso — usa el botón de arriba para registrar el primero."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {usuaria.casos.map((caso) => (
              <li key={caso.id}>
                <button
                  type="button"
                  onClick={() => onVerCaso(caso.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Caso {caso.numero} · {formatFechaGT(caso.fecha)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ETIQUETAS_TIPO_REGISTRO[caso.tipoRegistro]}
                      {caso.areasReferidas.length > 0 &&
                        ` · Referido a ${caso.areasReferidas.map((area) => ETIQUETAS_AREA_ATENCION[area]).join(', ')}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
