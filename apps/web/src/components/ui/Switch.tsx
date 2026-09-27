interface SwitchProps {
  encendido: boolean
  onChange: (valor: boolean) => void
  ariaLabel: string
  /** Siempre encendido y no editable (ej. Jurídico, que no se puede restringir). */
  bloqueado?: boolean
  /** El área todavía no fue referida: no aplica ningún valor. */
  deshabilitado?: boolean
  /** Texto debajo del switch (ej. "Siempre" / "Visible" / "Privado" / "No referida"). */
  etiqueta?: string
}

/** Switch de visibilidad de la matriz de accesos (plan de rediseño §12.1). */
export default function Switch({
  encendido,
  onChange,
  ariaLabel,
  bloqueado = false,
  deshabilitado = false,
  etiqueta,
}: SwitchProps) {
  const clasesPista = deshabilitado
    ? 'bg-gray-200 opacity-60 cursor-not-allowed'
    : bloqueado
      ? 'bg-brand-400 cursor-not-allowed'
      : encendido
        ? 'bg-brand-600'
        : 'bg-gray-300'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={encendido}
        aria-label={ariaLabel}
        disabled={bloqueado || deshabilitado}
        onClick={() => onChange(!encendido)}
        className={`relative h-5 w-9 rounded-full transition-colors ${clasesPista}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
            encendido ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
      {etiqueta && <span className="text-[11px] text-gray-400">{etiqueta}</span>}
    </div>
  )
}
