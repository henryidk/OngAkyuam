import { Search, UserSearch } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { formatFechaGT, type UsuariaResumenBusqueda } from '@akyuam/shared'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface BuscadorUsuariaProps {
  onSeleccionar: (usuaria: UsuariaResumenBusqueda) => void
  /** Contenido adicional (ej. "Es una persona nueva") que depende de quién use este buscador. */
  accionesExtra?: ReactNode
}

/**
 * Buscador reusado tanto por el paso 0 del wizard de registro como por la sección "Expediente":
 * un solo lugar que sabe hablar con `GET /trabajo-social/usuarias/buscar` (SRP — este componente
 * no sabe qué pasa después de elegir una usuaria, eso lo decide quien lo use).
 */
export default function BuscadorUsuaria({ onSeleccionar, accionesExtra }: BuscadorUsuariaProps) {
  const [dpi, setDpi] = useState('')
  const [nombre, setNombre] = useState('')
  const [resultados, setResultados] = useState<UsuariaResumenBusqueda[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscar(event: FormEvent) {
    event.preventDefault()
    const dpiLimpio = dpi.trim()
    const nombreLimpio = nombre.trim()
    if (!dpiLimpio && !nombreLimpio) {
      setError('Indica un DPI o un nombre para buscar')
      return
    }

    setBuscando(true)
    setError(null)
    try {
      const { data } = await api.get<UsuariaResumenBusqueda[]>('/trabajo-social/usuarias/buscar', {
        params: {
          ...(dpiLimpio ? { dpi: dpiLimpio } : {}),
          ...(nombreLimpio ? { nombre: nombreLimpio } : {}),
        },
      })
      setResultados(data)
    } catch (err) {
      setError(extraerMensajeError(err))
      setResultados(null)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">DPI</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={13}
            value={dpi}
            onChange={(event) => setDpi(event.target.value)}
            placeholder="13 dígitos"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Nombre o apellido</label>
          <input
            type="text"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Mínimo 3 caracteres"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <Button type="submit" cargando={buscando}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {resultados && resultados.length === 0 && (
        <EmptyState
          Icono={UserSearch}
          titulo="Sin resultados"
          descripcion="No se encontró ninguna usuaria con ese criterio."
        />
      )}

      {resultados && resultados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">DPI</th>
                <th className="px-4 py-3 font-medium">Fecha de nacimiento</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resultados.map((usuaria) => (
                <tr key={usuaria.id}>
                  <td className="px-4 py-3 text-gray-800">
                    {usuaria.nombres} {usuaria.apellidos}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{usuaria.dpi ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatFechaGT(usuaria.fechaNacimiento)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variante="secondary" onClick={() => onSeleccionar(usuaria)}>
                      Seleccionar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {accionesExtra}
    </div>
  )
}
