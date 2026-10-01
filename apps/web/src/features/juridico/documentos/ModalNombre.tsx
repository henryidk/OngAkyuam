import { useState } from 'react'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'

interface ModalNombreProps {
  titulo: string
  etiqueta: string
  valorInicial?: string
  maximo: number
  confirmarLabel: string
  /** Lanza si el servidor rechaza el nombre (p. ej. carpeta duplicada): el mensaje se muestra aquí. */
  onGuardar: (nombre: string) => Promise<void>
  onCerrar: () => void
}

/** Un solo campo de texto: crear o renombrar una carpeta, renombrar un documento. */
export default function ModalNombre({
  titulo,
  etiqueta,
  valorInicial = '',
  maximo,
  confirmarLabel,
  onGuardar,
  onCerrar,
}: ModalNombreProps) {
  const [nombre, setNombre] = useState(valorInicial)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    const limpio = nombre.trim()
    if (!limpio) {
      setError('Escriba un nombre')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await onGuardar(limpio)
    } catch (err) {
      setError(extraerMensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <ConfirmModal
      abierto
      titulo={titulo}
      confirmarLabel={confirmarLabel}
      cargando={enviando}
      error={error}
      onConfirmar={() => void confirmar()}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>{etiqueta}</span>
        <input
          type="text"
          autoFocus
          value={nombre}
          maxLength={maximo}
          onChange={(evento) => setNombre(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') void confirmar()
          }}
          className={CLASE_CAMPO}
        />
      </label>
    </ConfirmModal>
  )
}
