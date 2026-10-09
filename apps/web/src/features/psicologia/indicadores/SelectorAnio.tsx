interface SelectorAnioProps {
  anio: number
  /** Del más reciente al más antiguo. */
  anios: number[]
  onCambiar: (anio: number) => void
}

/** Solo los años que tienen procesos: no se puede pedir un año cualquiera escribiéndolo. */
export default function SelectorAnio({ anio, anios, onCambiar }: SelectorAnioProps) {
  const opciones = anios.includes(anio) ? anios : [anio, ...anios]
  return (
    <select
      aria-label="Año del reporte"
      value={anio}
      onChange={(evento) => onCambiar(Number(evento.target.value))}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
    >
      {opciones.map((opcion) => (
        <option key={opcion} value={opcion}>
          {opcion}
        </option>
      ))}
    </select>
  )
}
