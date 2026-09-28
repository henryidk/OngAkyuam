import { useEffect } from 'react'
import { useMatrizAccesos } from '../../accesos/useMatrizAccesos'
import { useContextoFicha, useCasoSeleccionado } from '../contextoFicha'
import SelectorCaso from '../SelectorCaso'
import PestanaAccesos from './PestanaAccesos'

/** Ruta `accesos` de la ficha: la matriz es por caso, con selector si hay varios. */
export default function RutaAccesos() {
  const { usuaria } = useContextoFicha()
  const { caso, seleccionar } = useCasoSeleccionado(usuaria)

  if (!caso) return <p className="text-sm text-gray-500">Esta usuaria todavía no tiene ningún caso registrado.</p>

  return (
    <div className="space-y-3">
      <SelectorCaso casos={usuaria.casos} seleccionado={caso} onSeleccionar={seleccionar} />
      <MatrizDelCaso key={caso.id} expedienteId={caso.id} />
    </div>
  )
}

function MatrizDelCaso({ expedienteId }: { expedienteId: string }) {
  const { version } = useContextoFicha()
  const accesos = useMatrizAccesos(expedienteId)
  const { recargar } = accesos

  // Un referido hecho desde el encabezado agrega una columna a la matriz.
  useEffect(() => {
    if (version > 0) void recargar()
  }, [version, recargar])

  return <PestanaAccesos accesos={accesos} />
}
