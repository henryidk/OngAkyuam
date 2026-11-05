import type { ReactNode } from 'react'
import { formatFechaGT, type FilaPersonaAtendidaPsicologia } from '@akyuam/shared'

/** Texto clínico o listas largas: dos líneas como máximo y el texto completo al pasar el cursor. */
function TextoLargo({ texto, ancho }: { texto: string; ancho: string }) {
  if (!texto) return <span className="text-gray-400">—</span>
  return (
    <span className={`line-clamp-2 block whitespace-normal break-words ${ancho}`} title={texto}>
      {texto}
    </span>
  )
}

function Estado({ estado }: { estado: FilaPersonaAtendidaPsicologia['estado'] }) {
  const clases = estado === 'Concluido' ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-700'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${clases}`}>{estado}</span>
}

interface Columna {
  titulo: string
  valor: (fila: FilaPersonaAtendidaPsicologia) => ReactNode
  /** Columnas fijas a la izquierda al desplazar la tabla: con ellas se sabe de quién es cada fila. */
  fija?: string
  derecha?: boolean
}

/** Mismas columnas y orden que el Excel. */
const COLUMNAS: Columna[] = [
  { titulo: 'No.', valor: (fila) => fila.numero, fija: 'left-0 w-12 min-w-12', derecha: true },
  { titulo: 'Persona', valor: (fila) => fila.persona, fija: 'left-12 w-20 min-w-20' },
  {
    titulo: 'No. expediente',
    valor: (fila) => <span className="font-medium text-gray-900">{fila.expedienteNumero}</span>,
    fija: 'left-32 w-28 min-w-28 shadow-[1px_0_0_0_var(--color-gray-200)]',
  },
  { titulo: 'Proceso', valor: (fila) => <TextoLargo texto={fila.procesos} ancho="min-w-[140px] max-w-[200px]" /> },
  { titulo: 'Edad', valor: (fila) => fila.edad, derecha: true },
  { titulo: 'Rango de edad', valor: (fila) => fila.rangoEdad },
  { titulo: 'Grupo étnico', valor: (fila) => fila.grupoEtnico },
  { titulo: 'Municipio', valor: (fila) => fila.municipio },
  { titulo: 'Tipología 22-2008', valor: (fila) => <TextoLargo texto={fila.tipologia} ancho="min-w-[160px] max-w-[220px]" /> },
  { titulo: 'Diagnóstico', valor: (fila) => <TextoLargo texto={fila.diagnostico} ancho="min-w-[180px] max-w-[260px]" /> },
  {
    titulo: 'Enfoque terapéutico',
    valor: (fila) => <TextoLargo texto={fila.enfoqueTerapeutico} ancho="min-w-[160px] max-w-[220px]" />,
  },
  { titulo: 'Semana de atención', valor: (fila) => fila.semanaAtencion, derecha: true },
  { titulo: 'Sesiones', valor: (fila) => fila.sesiones, derecha: true },
  { titulo: 'Inasistencias', valor: (fila) => fila.inasistencias, derecha: true },
  { titulo: 'Primera sesión', valor: (fila) => formatFechaGT(fila.primeraSesion) },
  { titulo: 'Última sesión', valor: (fila) => formatFechaGT(fila.ultimaSesion) },
  { titulo: 'Estado', valor: (fila) => <Estado estado={fila.estado} /> },
  { titulo: 'Responsable', valor: (fila) => fila.responsable },
]

/** Vista previa del Excel de personas atendidas: sin nombres, igual que el archivo. */
export default function TablaPersonasAtendidas({ filas }: { filas: FilaPersonaAtendidaPsicologia[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-[13px]">
        <thead className="text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            {COLUMNAS.map((columna) => (
              <th
                key={columna.titulo}
                scope="col"
                className={`bg-gray-50 px-3 py-2.5 font-medium ${columna.derecha ? 'text-right' : ''} ${
                  columna.fija ? `sticky z-10 ${columna.fija}` : ''
                }`}
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.numero} className="group border-t border-gray-100 align-top text-gray-700">
              {COLUMNAS.map((columna) => (
                <td
                  key={columna.titulo}
                  className={`px-3 py-2.5 tabular-nums group-hover:bg-gray-50 ${columna.derecha ? 'text-right' : ''} ${
                    columna.fija ? `sticky z-10 bg-white ${columna.fija}` : ''
                  }`}
                >
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
