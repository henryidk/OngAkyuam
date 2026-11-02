import { formatFechaGT, type FilaPoblacionBeneficiada } from '@akyuam/shared'

interface Columna {
  titulo: string
  valor: (fila: FilaPoblacionBeneficiada) => string | number
  /** Encabezado de grupo encima del título, igual que en el Excel. */
  grupo?: string
  /** Texto largo: se recorta en la vista previa y se lee completo al pasar el cursor. */
  largo?: boolean
}

const AREA_SOCIAL = 'Área social'
const REFERIDA = 'Referida al área'
const ATENCION = 'Áreas de atención'

const marca = (valor: boolean) => (valor ? 'X' : '')

/** Mismas columnas, orden y grupos que el Excel de población beneficiada. */
const COLUMNAS: Columna[] = [
  { titulo: 'No.', valor: (fila) => fila.numero },
  { titulo: 'Fecha de registro', valor: (fila) => formatFechaGT(fila.fecha) },
  { titulo: 'Departamento', valor: (fila) => fila.departamento },
  { titulo: 'Oficina responsable', valor: (fila) => fila.oficinaResponsable },
  { titulo: 'Municipio', valor: (fila) => fila.municipio },
  { titulo: 'No. de caso', valor: (fila) => fila.numeroCaso },
  { titulo: 'Fecha de nacimiento', valor: (fila) => formatFechaGT(fila.fechaNacimiento) },
  { titulo: 'Edad', valor: (fila) => fila.edad },
  { titulo: 'Nombres y apellidos', valor: (fila) => fila.nombresApellidos },
  { titulo: 'DPI', valor: (fila) => fila.dpi ?? '' },
  { titulo: 'Teléfono', valor: (fila) => fila.telefono ?? '' },
  { titulo: 'Género (M/H)', valor: (fila) => fila.genero },
  { titulo: 'Rango de edad', valor: (fila) => fila.rangoEdad },
  { titulo: 'Grupo étnico', valor: (fila) => fila.grupoEtnico },
  { titulo: 'Ubicación geográfica', valor: (fila) => fila.ubicacionGeografica },
  { titulo: 'Tipología del delito', valor: (fila) => fila.tipologia, largo: true },
  { titulo: 'Área urbana/rural', valor: (fila) => fila.areaResidencia, grupo: AREA_SOCIAL },
  { titulo: 'Gestante', valor: (fila) => marca(fila.condicionMaternidad === 'GESTANTE'), grupo: AREA_SOCIAL },
  { titulo: 'Lactante', valor: (fila) => marca(fila.condicionMaternidad === 'LACTANTE'), grupo: AREA_SOCIAL },
  { titulo: 'Normal', valor: (fila) => marca(fila.condicionMaternidad === 'NORMAL'), grupo: AREA_SOCIAL },
  { titulo: 'Ocupación', valor: (fila) => fila.ocupacion, grupo: AREA_SOCIAL },
  { titulo: 'Idioma de atención', valor: (fila) => fila.idiomaAtencion, grupo: AREA_SOCIAL },
  { titulo: 'Derivada a albergue', valor: (fila) => (fila.derivadaAlbergue ? 'Sí' : 'No'), grupo: AREA_SOCIAL },
  { titulo: 'Atendida por', valor: (fila) => fila.atendidaPor, grupo: AREA_SOCIAL },
  { titulo: 'Descripción de referencia', valor: (fila) => fila.descripcionReferencia, grupo: AREA_SOCIAL, largo: true },
  { titulo: 'Atención brindada', valor: (fila) => fila.atencionTrabajoSocial, grupo: AREA_SOCIAL, largo: true },
  { titulo: 'Legal', valor: (fila) => marca(fila.referidaJuridico), grupo: REFERIDA },
  { titulo: 'Psicológica', valor: (fila) => marca(fila.referidaPsicologia), grupo: REFERIDA },
  { titulo: 'Médica', valor: (fila) => marca(fila.referidaMedica), grupo: REFERIDA },
  { titulo: 'Legal: proceso requerido', valor: (fila) => fila.procesoRequerido, grupo: ATENCION, largo: true },
  { titulo: 'Psicológica: atención brindada', valor: (fila) => fila.atencionPsicologica, grupo: ATENCION, largo: true },
  { titulo: 'Médica: atención brindada', valor: (fila) => fila.atencionMedica, grupo: ATENCION, largo: true },
]

/** Primera fila del encabezado: columnas sueltas (ocupan las dos filas) y grupos consecutivos. */
function celdasSuperiores(): { clave: string; titulo: string; ancho: number; agrupada: boolean }[] {
  const celdas: { clave: string; titulo: string; ancho: number; agrupada: boolean }[] = []
  for (const columna of COLUMNAS) {
    const ultima = celdas.at(-1)
    if (columna.grupo && ultima?.agrupada && ultima.titulo === columna.grupo) {
      ultima.ancho += 1
    } else if (columna.grupo) {
      celdas.push({ clave: columna.grupo, titulo: columna.grupo, ancho: 1, agrupada: true })
    } else {
      celdas.push({ clave: columna.titulo, titulo: columna.titulo, ancho: 1, agrupada: false })
    }
  }
  return celdas
}

const SUPERIORES = celdasSuperiores()
const AGRUPADAS = COLUMNAS.filter((columna) => columna.grupo)

export default function TablaVistaPrevia({ filas }: { filas: FilaPoblacionBeneficiada[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-[13px]">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            {SUPERIORES.map((celda) =>
              celda.agrupada ? (
                <th
                  key={celda.clave}
                  scope="colgroup"
                  colSpan={celda.ancho}
                  className="border-b border-l border-gray-200 px-3 py-2 text-center font-semibold text-gray-700"
                >
                  {celda.titulo}
                </th>
              ) : (
                <th key={celda.clave} scope="col" rowSpan={2} className="px-3 py-2.5 align-bottom font-medium">
                  {celda.titulo}
                </th>
              ),
            )}
          </tr>
          <tr>
            {AGRUPADAS.map((columna) => (
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
              {COLUMNAS.map((columna) => {
                const valor = columna.valor(fila)
                return (
                  <td
                    key={columna.titulo}
                    title={columna.largo && valor ? String(valor) : undefined}
                    className={`px-3 py-2.5 tabular-nums ${columna.largo ? 'max-w-[240px] truncate' : ''}`}
                  >
                    {valor}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
