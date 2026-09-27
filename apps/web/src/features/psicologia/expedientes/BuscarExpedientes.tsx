import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA, type ExpedienteResumenBusqueda } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { extraerMensajeError } from '../../../lib/errors'
import { buscarExpedientes } from '../api/psicologia.api'

export default function BuscarExpedientes() {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ExpedienteResumenBusqueda[] | null>(null)
  const [siguienteCursor, setSiguienteCursor] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscar(cursor?: string) {
    if (q.trim().length < 3) {
      setError('Escribe al menos 3 caracteres')
      return
    }
    setBuscando(true)
    setError(null)
    try {
      const pagina = await buscarExpedientes({ q: q.trim(), cursor })
      setResultados((actuales) => (cursor ? [...(actuales ?? []), ...pagina.items] : pagina.items))
      setSiguienteCursor(pagina.siguienteCursor)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void buscar()
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs text-gray-500">Nombre o número de expediente</span>
          <input
            type="text"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar entre mis expedientes…"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit" cargando={buscando}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {resultados !== null && resultados.length === 0 && (
        <EmptyState Icono={Search} titulo="Sin resultados" descripcion="No se encontraron expedientes tuyos con ese criterio." />
      )}

      {resultados !== null && resultados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Usuaria</th>
                <th className="px-4 py-3 font-medium">Nº expediente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Municipio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resultados.map((expediente) => (
                <tr key={expediente.expedienteId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/psicologia/expedientes/${expediente.expedienteId}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {expediente.usuariaNombreCompleto}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{expediente.numero}</td>
                  <td className="px-4 py-3">
                    <Badge>{ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[expediente.estado]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{expediente.municipio ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {siguienteCursor && (
            <div className="border-t border-gray-100 p-3 text-center">
              <Button variante="secondary" cargando={buscando} onClick={() => buscar(siguienteCursor)}>
                Cargar más
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
