/** Código de la atención médica ("M1-19-2026") en monoespaciada, como en el mockup. */
export default function CodigoAtencion({ codigo, className = '' }: { codigo: string; className?: string }) {
  return <span className={`font-mono text-[12px] text-[#5b6573] ${className}`}>{codigo}</span>
}
