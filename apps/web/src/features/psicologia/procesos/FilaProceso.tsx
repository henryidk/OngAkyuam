import { Link, useNavigate } from 'react-router-dom'
import { formatInstanteGT, type FilaProcesoPsicologia, type ProcesoPsicologiaResumen } from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'
import EtiquetaEtapa from '../compartido/EtiquetaEtapa'
import { RUTAS_PSICOLOGIA } from '../rutas'
import CodigoProceso from '../compartido/CodigoProceso'

function ProximaCita({ proceso }: { proceso: ProcesoPsicologiaResumen }) {
  if (proceso.fechaCierre) return <span className="text-gray-500">Cerrado {fechaDeInstante(proceso.fechaCierre)}</span>
  if (!proceso.proximaCita) return <span className="font-medium text-amber-800">Sin próxima cita</span>
  return <span className="text-gray-900">{formatInstanteGT(proceso.proximaCita.fechaHora)}</span>
}

interface FilaProcesoProps {
  proceso: FilaProcesoPsicologia
  /** Muestra la columna "Atiende": solo en la vista del equipo. */
  conResponsable: boolean
}

/** Una fila por persona atendida: en un hijo/a se dice de quién es, para no confundirlo con una usuaria. */
export default function FilaProceso({ proceso, conResponsable }: FilaProcesoProps) {
  const navigate = useNavigate()
  const destino = RUTAS_PSICOLOGIA.proceso(proceso.id)
  return (
    // Toda la fila abre el detalle; el enlace del código es el que recibe el foco del teclado.
    <tr onClick={() => navigate(destino)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <Link
          to={destino}
          onClick={(evento) => evento.stopPropagation()}
          className="text-brand-700 hover:underline"
        >
          <CodigoProceso codigo={proceso.codigo} />
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{proceso.persona.nombreCompleto}</p>
        {proceso.persona.ninoId !== null && <p className="text-xs text-gray-500">Hijo/a de {proceso.usuariaNombreCompleto}</p>}
        <p className="text-xs text-gray-500 tabular-nums">Exp. {proceso.expedienteNumero}</p>
      </td>
      {conResponsable && (
        <td className="px-4 py-3 text-sm text-gray-700">{proceso.propio ? <span className="font-medium">Tú</span> : proceso.psicologa}</td>
      )}
      <td className="px-4 py-3">
        <EtiquetaEtapa etapa={proceso.etapa} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 tabular-nums">{proceso.sesionesAtendidas}</td>
      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
        {proceso.ultimaSesion ? fechaDeInstante(proceso.ultimaSesion.fechaHora) : '—'}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        <ProximaCita proceso={proceso} />
      </td>
    </tr>
  )
}
