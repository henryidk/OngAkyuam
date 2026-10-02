import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_REGISTRO, formatFechaGT, type ExpedienteResumenArea } from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import { crearSocketArea } from '../../lib/socket'

interface PanelAreaProps {
  basePath: string
  /**
   * Render prop por fila, solo usada por jurídico hoy (psicológica/médica no la pasan, sin
   * cambios de comportamiento para ellas — ver planjuridico.md, punto 7). Cuando está
   * presente, el número deja de ser un link de navegación: las acciones de esta columna
   * son la única forma de entrar al caso.
   */
  renderAcciones?: (expediente: ExpedienteResumenArea) => ReactNode
}

export default function PanelArea({ basePath, renderAcciones }: PanelAreaProps) {
  const [expedientes, setExpedientes] = useState<ExpedienteResumenArea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get<ExpedienteResumenArea[]>('/areas/expedientes')
      setExpedientes(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const socket = crearSocketArea()
    socket.on('referido:nuevo', (resumen: ExpedienteResumenArea) => {
      setExpedientes((actuales) => {
        if (!actuales || actuales.some((expediente) => expediente.id === resumen.id)) {
          return actuales
        }
        return [resumen, ...actuales]
      })
    })
    // Trabajo Social corrigió los datos personales: el aviso trae solo el id, los datos se vuelven a pedir.
    socket.on('usuaria:actualizada', () => void cargar())
    return () => {
      socket.disconnect()
    }
  }, [cargar])

  return (
    <div>
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
                {renderAcciones && <th className="px-4 py-3 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expedientes.map((expediente) => (
                <tr key={expediente.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {renderAcciones ? (
                      <span className="font-medium text-gray-800">{expediente.numero}</span>
                    ) : (
                      <Link to={`${basePath}/${expediente.id}`} className="font-medium text-brand-600 hover:underline">
                        {expediente.numero}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatFechaGT(expediente.fecha)}</td>
                  <td className="px-4 py-3 text-gray-800">{expediente.usuariaNombreCompleto}</td>
                  <td className="px-4 py-3 text-gray-600">{ETIQUETAS_TIPO_REGISTRO[expediente.tipoRegistro]}</td>
                  {renderAcciones && <td className="px-4 py-3">{renderAcciones(expediente)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
