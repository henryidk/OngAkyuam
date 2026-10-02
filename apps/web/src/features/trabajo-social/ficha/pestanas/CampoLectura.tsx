interface CampoLecturaProps {
  etiqueta: string
  valor: string | null | undefined
  /** Cifras alineadas (DPI, teléfono, fechas). */
  formato?: 'numerico'
}

/** Dato de solo lectura de la ficha. Sin valor (o solo espacios) muestra una raya, nunca un hueco. */
export default function CampoLectura({ etiqueta, valor, formato }: CampoLecturaProps) {
  const texto = valor?.trim() ?? ''
  return (
    <div>
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      {texto === '' ? (
        <dd className="mt-0.5 text-sm text-gray-400">—</dd>
      ) : (
        <dd className={`mt-0.5 text-sm text-gray-900 ${formato === 'numerico' ? 'tabular-nums' : ''}`}>{texto}</dd>
      )}
    </div>
  )
}
