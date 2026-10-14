import { useState } from 'react'
import { SIGNOS_VITALES_FORMULARIO, calcularImc, type CampoSignoFormulario } from '@akyuam/shared'
import { CLASE_TARJETA } from '../compartido/estilos'
import { leerSignos, type ValoresSignos } from './signosFormulario'

interface CamposSignosProps {
  valores: ValoresSignos
  onCambiar: (clave: CampoSignoFormulario, valor: string) => void
  /** Tras intentar guardar se muestran todos los errores, no solo los de casillas ya visitadas. */
  mostrarTodos: boolean
}

/** Signos vitales opcionales, con el IMC calculado al vuelo. El error aparece al salir de la casilla. */
export default function CamposSignos({ valores, onCambiar, mostrarTodos }: CamposSignosProps) {
  const [visitadas, setVisitadas] = useState<Set<CampoSignoFormulario>>(() => new Set())
  const { signos, errores } = leerSignos(valores)
  const imc = calcularImc(signos.pesoKg, signos.tallaM)

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-3 px-5 py-[18px]`}>
      <div className="flex flex-wrap justify-between gap-2.5">
        <h2 className="text-sm font-semibold text-[#1c2430]">Signos vitales</h2>
        <span className="text-xs text-[#5b6573]">Opcionales · deja vacío lo que no se tomó</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
        {SIGNOS_VITALES_FORMULARIO.map(({ clave, etiqueta, unidad, ejemplo }) => {
          const error = (mostrarTodos || visitadas.has(clave)) && valores[clave].trim() !== '' ? errores[clave] : undefined
          const idError = `signo-${clave}-error`
          return (
            <label key={clave} className="flex flex-col gap-1">
              <span className="whitespace-nowrap text-xs font-medium text-[#5b6573]">{etiqueta}</span>
              <span
                className={`flex items-center overflow-hidden rounded-md border bg-white focus-within:ring-1 ${
                  error
                    ? 'border-[#d4574a] focus-within:ring-[#d4574a]'
                    : 'border-[#d5dadf] focus-within:border-brand-500 focus-within:ring-brand-500'
                }`}
              >
                <input
                  value={valores[clave]}
                  onChange={(evento) => onCambiar(clave, evento.target.value)}
                  onBlur={() => setVisitadas((actuales) => new Set(actuales).add(clave))}
                  placeholder={ejemplo}
                  inputMode={clave === 'presionArterial' ? 'text' : 'decimal'}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? idError : undefined}
                  className="w-full min-w-0 flex-1 border-0 px-2.5 py-2 font-mono text-[13.5px] text-[#1c2430] outline-none"
                />
                <span className="whitespace-nowrap px-2 text-[11.5px] text-[#9aa4b0]">{unidad}</span>
              </span>
              {error && (
                <span id={idError} className="text-[11.5px] text-[#9b2c20]">
                  {error}
                </span>
              )}
            </label>
          )
        })}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#5b6573]">IMC (calculado)</span>
          <span aria-live="polite" className="rounded-md border border-[#eef0f2] bg-[#f8f9fa] px-2.5 py-2 font-mono text-[13.5px] text-[#374151]">
            {imc ?? '—'}
          </span>
        </div>
      </div>
    </section>
  )
}
