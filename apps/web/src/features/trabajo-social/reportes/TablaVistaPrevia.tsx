import { ETIQUETAS_CORTAS_TIPO_REGISTRO, formatFechaGT, type FilaPoblacionBeneficiada } from '@akyuam/shared'

/** Mismas columnas y orden que el Excel (plan §3.8). */
const COLUMNAS: { titulo: string; valor: (fila: FilaPoblacionBeneficiada) => string | number }[] = [
  { titulo: 'No.', valor: (fila) => fila.numero },
  { titulo: 'Fecha', valor: (fila) => formatFechaGT(fila.fecha) },
  { titulo: 'Departamento', valor: (fila) => fila.departamento },
  { titulo: 'Municipio', valor: (fila) => fila.municipio },
  { titulo: 'No. de caso', valor: (fila) => fila.numeroCaso },
  { titulo: 'Fecha de nacimiento', valor: (fila) => formatFechaGT(fila.fechaNacimiento) },
  { titulo: 'Edad', valor: (fila) => fila.edad },
  { titulo: 'Rango de edad', valor: (fila) => fila.rangoEdad },
  { titulo: 'Nombres y apellidos', valor: (fila) => fila.nombresApellidos },
  { titulo: 'DPI', valor: (fila) => fila.dpi ?? '' },
  { titulo: 'Género', valor: (fila) => fila.genero },
  { titulo: 'Grupo étnico', valor: (fila) => fila.grupoEtnico },
  { titulo: 'Ubicación geográfica', valor: (fila) => fila.ubicacionGeografica },
  { titulo: 'Tipología 22-2008', valor: (fila) => fila.tipologia },
  { titulo: 'Registro', valor: (fila) => ETIQUETAS_CORTAS_TIPO_REGISTRO[fila.registro] },
  { titulo: 'Relación', valor: (fila) => fila.relacion },
]

export default function TablaVistaPrevia({ filas }: { filas: FilaPoblacionBeneficiada[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-[13px]">
        <thead className="bg-gray-50 text-left text-gray-500">
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
            <tr
              key={fila.numero}
              className={`border-t border-gray-100 text-gray-800 ${fila.esUsuaria ? '' : 'bg-brand-50/40'}`}
            >
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
