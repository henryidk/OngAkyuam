import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { buscarUsuariaPorDpi } from '../../trabajo-social/api/trabajoSocial.api'

type Resultado =
  | { tipo: 'libre' }
  | { tipo: 'existe'; usuariaId: string }
  | { tipo: 'error'; mensaje: string }

interface VerificarDpiProps {
  dpi: string
}

/**
 * Segunda red contra duplicados (la primera es la búsqueda previa al wizard): antes de guardar,
 * confirma que el DPI capturado no pertenezca ya a otra usuaria. Nunca muestra el nombre de la
 * existente — solo el enlace a su ficha, mismo criterio que el 409 del backend.
 */
export default function VerificarDpi({ dpi }: VerificarDpiProps) {
  // Se guarda con el DPI verificado: si después se edita el DPI, el resultado anterior ya no aplica.
  const [verificacion, setVerificacion] = useState<{ dpi: string; resultado: Resultado } | null>(null)
  const [verificando, setVerificando] = useState(false)
  const dpiCompleto = /^\d{13}$/.test(dpi)
  const resultado = verificacion?.dpi === dpi ? verificacion.resultado : null

  async function verificar() {
    setVerificando(true)
    try {
      const coincidencias = await buscarUsuariaPorDpi(dpi)
      setVerificacion({
        dpi,
        resultado:
          coincidencias.length > 0 ? { tipo: 'existe', usuariaId: coincidencias[0].id } : { tipo: 'libre' },
      })
    } catch (err) {
      setVerificacion({ dpi, resultado: { tipo: 'error', mensaje: extraerMensajeError(err) } })
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div>
        <Button type="button" variante="secondary" disabled={!dpiCompleto} cargando={verificando} onClick={verificar}>
          Verificar
        </Button>
      </div>
      {resultado?.tipo === 'libre' && (
        <p className="text-xs text-green-700">
          No existe ninguna usuaria con este DPI. Si ya fue atendida antes, búscala en Expediente y registra un
          nuevo caso.
        </p>
      )}
      {resultado?.tipo === 'existe' && (
        <p className="text-xs text-amber-700">
          Ya existe una usuaria con este DPI.{' '}
          <Link
            to="/trabajo-social/expediente"
            state={{ usuariaId: resultado.usuariaId }}
            className="font-medium underline"
          >
            Ver su ficha
          </Link>{' '}
          y registra ahí un nuevo caso.
        </p>
      )}
      {resultado?.tipo === 'error' && <p className="text-xs text-red-600">{resultado.mensaje}</p>}
    </div>
  )
}
