import { Link, useNavigate } from 'react-router-dom'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  type ProcesoResumen,
} from '@akyuam/shared'
import { BarraAvanceCompacta } from '../compartido/BarraAvance'
import { fechaDeReferencia, textoAlerta } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'

export default function FilaProceso({ proceso }: { proceso: ProcesoResumen }) {
  const alerta = textoAlerta(proceso)
  const navigate = useNavigate()
  const destino = RUTAS_JURIDICO.proceso(proceso.id)
  return (
    // Toda la fila abre el detalle; el enlace del código es el que recibe el foco del teclado.
    <tr
      onClick={() => navigate(destino)}
      className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
    >
      <td className="px-4 py-3 align-top">
        <Link
          to={destino}
          onClick={(evento) => evento.stopPropagation()}
          className="font-mono text-[13px] font-medium text-brand-700 hover:underline"
        >
          {proceso.codigo}
        </Link>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-gray-900">{proceso.usuaria.nombreCompleto}</p>
        <p className="text-xs text-gray-500 tabular-nums">Exp. {proceso.expedienteNumero}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
        <p className="text-xs text-gray-500">
          {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]} ·{' '}
          {proceso.abogada?.nombre ?? 'Sin abogada asignada'}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <BarraAvanceCompacta fase={proceso.fase} estado={proceso.estadoVisible} />
      </td>
      <td className="space-y-1 px-4 py-3 align-top">
        <p className="text-xs text-gray-500 tabular-nums">{fechaDeReferencia(proceso)}</p>
        {alerta && <p className="text-xs font-medium text-[#8a5a14]">● {alerta}</p>}
      </td>
    </tr>
  )
}
