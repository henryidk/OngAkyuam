import { useCallback, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { ATAJOS, useAtajosTeclado } from '../lib/atajos'
import Modal, { CuerpoModal } from './ui/Modal'

/**
 * Activa los atajos de teclado del área y la ayuda que los lista al pulsar "?" (plan V5.3).
 * Se monta una vez por layout; cada pantalla marca sus botones con `data-atajo`.
 */
export default function AtajosTeclado() {
  const [abierta, setAbierta] = useState(false)
  const abrir = useCallback(() => setAbierta(true), [])
  useAtajosTeclado(abrir)

  return (
    <Modal abierto={abierta} titulo="Atajos de teclado" Icono={Keyboard} ancho="md" onCerrar={() => setAbierta(false)}>
      <CuerpoModal>
        <dl className="flex flex-col divide-y divide-gray-100">
          {ATAJOS.map((atajo) => (
            <div key={atajo.accion} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="flex flex-none gap-1">
                {atajo.teclas.map((tecla) => (
                  <kbd
                    key={tecla}
                    className="min-w-7 rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 text-center font-mono text-[13px] text-gray-800"
                  >
                    {tecla}
                  </kbd>
                ))}
              </dt>
              <dd className="text-right text-sm text-gray-700">{atajo.accion}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-gray-500">
          No funcionan mientras escribes en un campo ni con una ventana abierta.
        </p>
      </CuerpoModal>
    </Modal>
  )
}
