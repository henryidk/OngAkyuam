import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_REGISTRO, formatFechaGT, type ExpedienteResumenArea } from '@akyuam/shared'
import PanelLayout from '../../components/PanelLayout'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface PanelAreaProps {
  titulo: string
  basePath: string
}

export default function PanelArea({ titulo, basePath }: PanelAreaProps) {
  const [expedientes, setExpedientes] = useState<ExpedienteResumenArea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api
      .get<ExpedienteResumenArea[]>('/areas/expedientes')
      .then(({ data }) => {
        if (!cancelado) setExpedientes(data)
      })
      .catch((err) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [])

  return (
    <PanelLayout titulo={titulo}>
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!error && expedientes === null && <p className="text-sm text-gray-500">Cargando casos…</p>}

      {!error && expedientes !== null && expedientes.length === 0 && (
        <p className="text-sm text-gray-500">Sin casos referidos todavía.</p>
      )}

      {!error && expedientes !== null && expedientes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Usuaria</th>
                <th className="px-4 py-3 font-medium">Tipo de registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expedientes.map((expediente) => (
                <tr key={expediente.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`${basePath}/${expediente.id}`} className="font-medium text-brand-600 hover:underline">
                      {expediente.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatFechaGT(expediente.fecha)}</td>
                  <td className="px-4 py-3 text-gray-800">{expediente.usuariaNombreCompleto}</td>
                  <td className="px-4 py-3 text-gray-600">{ETIQUETAS_TIPO_REGISTRO[expediente.tipoRegistro]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelLayout>
  )
}
