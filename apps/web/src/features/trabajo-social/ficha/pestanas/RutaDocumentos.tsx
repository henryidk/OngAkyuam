import { useContextoFicha, useCasoSeleccionado } from '../contextoFicha'
import SelectorCaso from '../SelectorCaso'
import PestanaDocumentos from './PestanaDocumentos'

/** Ruta `documentos` de la ficha: los documentos son por caso, con selector si hay varios. */
export default function RutaDocumentos() {
  const { usuaria, version } = useContextoFicha()
  const { caso, seleccionar } = useCasoSeleccionado(usuaria)

  if (!caso) return <p className="text-sm text-gray-500">Esta usuaria todavía no tiene ningún caso registrado.</p>

  return (
    <div className="space-y-3">
      <SelectorCaso casos={usuaria.casos} seleccionado={caso} onSeleccionar={seleccionar} />
      {/* `version` en la key: tras un egreso, el Convenio de egreso cambia de estado sin recargar. */}
      <PestanaDocumentos key={`${caso.id}-${version}`} expedienteId={caso.id} />
    </div>
  )
}
