import type { ReactNode } from 'react'
import { ETIQUETAS_TIPO_PROCESO_JURIDICO, formatFechaGT, type FilaReporteJuridico } from '@akyuam/shared'

/** La tabla no parte líneas; los textos largos sí, con ancho acotado. */
function TextoLargo({ children, ancho }: { children: ReactNode; ancho: string }) {
  return <span className={`block whitespace-normal break-words ${ancho}`}>{children}</span>
}

function Responsables({ fila }: { fila: FilaReporteJuridico }) {
  const personas = [
    { rol: 'Abogada', nombre: fila.abogada },
    { rol: 'Procuradora', nombre: fila.procuradora },
  ].filter((persona) => persona.nombre)
  if (personas.length === 0) return <span className="text-gray-400">Sin asignar</span>
  return (
    <span className="block space-y-0.5">
      {personas.map((persona) => (
        <span key={persona.rol} className="block">
          {persona.nombre} <span className="text-[11px] text-gray-500">· {persona.rol}</span>
        </span>
      ))}
    </span>
  )
}

/** Mismas columnas y orden que el Excel. */
const COLUMNAS: { titulo: string; valor: (fila: FilaReporteJuridico) => ReactNode }[] = [
  { titulo: 'No.', valor: (fila) => fila.numero },
  { titulo: 'No. expediente', valor: (fila) => fila.numeroInterno },
  { titulo: 'Nombre de la usuaria', valor: (fila) => fila.usuaria },
  { titulo: 'Teléfono', valor: (fila) => fila.telefono ?? '—' },
  {
    titulo: 'Tipo de proceso',
    valor: (fila) => <TextoLargo ancho="min-w-[180px] max-w-[240px]">{ETIQUETAS_TIPO_PROCESO_JURIDICO[fila.tipo]}</TextoLargo>,
  },
  {
    titulo: 'No. expediente juzgado',
    valor: (fila) =>
      fila.numeroJudicial ? <TextoLargo ancho="min-w-[200px] max-w-[260px]">{fila.numeroJudicial}</TextoLargo> : '—',
  },
  {
    titulo: 'Avance en el trámite',
    valor: (fila) =>
      fila.ultimoAvance ? (
        <TextoLargo ancho="min-w-[240px] max-w-[320px]">
          <span className="block text-[11px] text-gray-500">
            {formatFechaGT(fila.ultimoAvance.fecha)} · {fila.ultimoAvance.tipo}
          </span>
          <span className="line-clamp-3" title={fila.ultimoAvance.contenido}>
            {fila.ultimoAvance.contenido}
          </span>
        </TextoLargo>
      ) : (
        <span className="text-gray-400">Sin avances</span>
      ),
  },
  { titulo: 'Responsable', valor: (fila) => <Responsables fila={fila} /> },
  { titulo: 'Etnia', valor: (fila) => fila.grupoEtnico },
  { titulo: 'Edad', valor: (fila) => fila.edad },
  { titulo: 'Tipo de violencia', valor: (fila) => fila.tipologia || '—' },
  {
    titulo: 'Procedencia',
    valor: (fila) => (fila.procedencia ? <TextoLargo ancho="min-w-[180px] max-w-[240px]">{fila.procedencia}</TextoLargo> : '—'),
  },
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
            <tr key={fila.numero} className="border-t border-gray-100 align-top text-gray-700">
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
