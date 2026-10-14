import { calcularImc, SIGNOS_VITALES_FORMULARIO, type SignosVitalesDto } from '@akyuam/shared'
import { valorSigno } from './textoSignos'

interface Mosaico {
  clave: string
  etiqueta: string
  valor: string
  unidad: string
  anterior: string | null
}

function mosaicos(signos: SignosVitalesDto, anterior: SignosVitalesDto | null | undefined): Mosaico[] {
  const lista: Mosaico[] = SIGNOS_VITALES_FORMULARIO.flatMap(({ clave, etiqueta, unidad }) => {
    const valor = valorSigno(signos, clave)
    if (valor === null) return []
    return [{ clave, etiqueta, valor, unidad, anterior: anterior ? valorSigno(anterior, clave) : null }]
  })
  const imc = calcularImc(signos.pesoKg, signos.tallaM)
  if (imc !== null) {
    const imcAnterior = anterior ? calcularImc(anterior.pesoKg, anterior.tallaM) : null
    lista.push({
      clave: 'imc',
      etiqueta: 'Índice de masa corporal',
      valor: String(imc),
      unidad: '',
      anterior: imcAnterior === null ? null : String(imcAnterior),
    })
  }
  return lista
}

interface SignosVitalesProps {
  signos: SignosVitalesDto
  /**
   * Toma anterior para comparar: `null` = es la primera toma ("Primera toma"); sin la prop no
   * se muestra comparación (el detalle de una consulta del historial).
   */
  anterior?: SignosVitalesDto | null
}

/** Mosaicos de signos vitales: solo los que se tomaron, más el IMC si hay peso y talla. */
export default function SignosVitales({ signos, anterior }: SignosVitalesProps) {
  const lista = mosaicos(signos, anterior)
  if (lista.length === 0) {
    return <p className="text-sm text-[#5b6573]">No se tomaron signos vitales.</p>
  }
  const compara = anterior !== undefined
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
      {lista.map((mosaico) => (
        <div key={mosaico.clave} className="rounded-lg bg-[#f8f9fa] px-3 py-2.5">
          <dt className="text-[11.5px] text-[#5b6573]">{mosaico.etiqueta}</dt>
          <dd className="mt-0.5 text-[17px] font-semibold tabular-nums text-[#1c2430]">
            {mosaico.valor}
            {mosaico.unidad && <span className="ml-1 text-xs font-normal text-[#5b6573]">{mosaico.unidad}</span>}
          </dd>
          {compara && (
            <dd className="mt-0.5 text-[11.5px] text-[#9aa4b0]">
              {mosaico.anterior !== null
                ? `Anterior: ${mosaico.anterior}${mosaico.unidad ? ` ${mosaico.unidad}` : ''}`
                : 'Primera toma'}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}
