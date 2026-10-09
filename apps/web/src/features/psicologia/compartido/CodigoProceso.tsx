interface CodigoProcesoProps {
  codigo: string
  /** Solo color: el tamaño y la tipografía son los mismos en todo el módulo. */
  className?: string
}

/** Código de un proceso (p. ej. "P1-19-2026"), siempre con la misma tipografía y tamaño. */
export default function CodigoProceso({ codigo, className = '' }: CodigoProcesoProps) {
  return <span className={`font-mono text-[13px] font-medium tabular-nums ${className}`}>{codigo}</span>
}
