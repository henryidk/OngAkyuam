import type { ReactNode } from 'react'
import {
  ETIQUETAS_FORMA_FINALIZACION,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type FechaHoraAudienciaReporte,
  type FilaReporteJuridico,
} from '@akyuam/shared'
import EtiquetaEstado from '../compartido/EtiquetaEstado'

function fechaHora(audiencia: FechaHoraAudienciaReporte | null): string {
  return audiencia ? `${formatFechaGT(audiencia.fecha)} ${audiencia.hora}` : '—'
}

/** Mismas columnas y orden que el Excel; forma y fecha de cierre van juntas en pantalla. */
const COLUMNAS: { titulo: string; valor: (fila: FilaReporteJuridico) => ReactNode }[] = [
  { titulo: 'No.', valor: (fila) => fila.numero },
  { titulo: 'No. expediente', valor: (fila) => fila.expedienteNumero },
  { titulo: 'No. proceso', valor: (fila) => fila.numeroProceso },
  { titulo: 'Usuaria', valor: (fila) => fila.usuaria },
  { titulo: 'Tipo de proceso', valor: (fila) => ETIQUETAS_TIPO_PROCESO_JURIDICO[fila.tipo] },
  { titulo: 'Fecha inicio', valor: (fila) => formatFechaGT(fila.fechaInicio) },
  { titulo: 'Abogada', valor: (fila) => fila.abogada ?? '—' },
  { titulo: 'Estado', valor: (fila) => <EtiquetaEstado estado={fila.estado} /> },
  {
    titulo: 'Forma · cierre',
    valor: (fila) =>
      fila.formaFinalizacion && fila.fechaCierre
        ? `${ETIQUETAS_FORMA_FINALIZACION[fila.formaFinalizacion]} · ${formatFechaGT(fila.fechaCierre)}`
        : '—',
  },
  { titulo: 'No. judicial', valor: (fila) => fila.numeroJudicial ?? '—' },
  { titulo: 'Cartera', valor: (fila) => fila.cartera || '—' },
  { titulo: 'Próxima audiencia', valor: (fila) => fechaHora(fila.proximaAudiencia) },
  { titulo: 'Última realizada', valor: (fila) => fechaHora(fila.ultimaAudienciaRealizada) },
]

export default function TablaReporteJuridico({ filas }: { filas: FilaReporteJuridico[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-[13px]">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            {COLUMNAS.map((columna) => (
              <th key={columna.titulo} scope="col" className="px-3 py-2.5 font-medium">
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.numero} className="border-t border-gray-100 text-gray-700">
              {COLUMNAS.map((columna) => (
                <td key={columna.titulo} className="px-3 py-2.5 tabular-nums">
                  {columna.valor(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
