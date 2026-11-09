import { useState } from 'react'
import { Info } from 'lucide-react'
import { GLOSARIO, type AreaGlosario, type TerminoGlosario } from '../lib/glosario'
import Modal, { CuerpoModal } from './ui/Modal'

interface AyudaTerminoProps {
  area: AreaGlosario
  termino: TerminoGlosario
}

/**
 * Ícono (i) junto a un aviso o un título: abre el glosario del área con ese término resaltado.
 * Es un botón aparte, nunca dentro de un enlace.
 */
export function AyudaTermino({ area, termino }: AyudaTerminoProps) {
  const [abierto, setAbierto] = useState(false)
  const nombre = GLOSARIO[area].find((uno) => uno.termino === termino)?.nombre ?? ''

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Qué significa "${nombre}"`}
        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-texto-sutil hover:bg-superficie hover:text-texto focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Info aria-hidden="true" className="h-4 w-4" />
      </button>
      <Modal abierto={abierto} titulo="Glosario" ancho="md" onCerrar={() => setAbierto(false)}>
        <CuerpoModal>
          <dl className="flex flex-col gap-1">
            {GLOSARIO[area].map((definicion) => {
              const actual = definicion.termino === termino
              return (
                <div
                  key={definicion.termino}
                  aria-current={actual ? 'true' : undefined}
                  className={`rounded-lg px-3 py-2.5 ${actual ? 'bg-seleccion' : ''}`}
                >
                  <dt className="text-sm font-semibold text-texto">{definicion.nombre}</dt>
                  <dd className="mt-0.5 text-sm text-texto-cuerpo">{definicion.texto}</dd>
                </div>
              )
            })}
          </dl>
        </CuerpoModal>
      </Modal>
    </>
  )
}
