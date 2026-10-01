import { useCallback, useState } from 'react'
import { hoyGT, registrarEgresoSchema } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { registrarEgreso, subirDocumentoCaso } from '../api/trabajoSocial.api'
import { validarArchivoDocumento } from '../documentos/archivoDocumento'
import type { ResultadoEgreso } from './textoEgreso'

/**
 * Estado del modal "Registrar egreso". El convenio es opcional y se sube después de guardar la
 * fecha: el backend solo acepta `CONVENIO_EGRESO` cuando el caso ya tiene egreso.
 */
export function useRegistrarEgreso(expedienteId: string, onRegistrado: (resultado: ResultadoEgreso) => void) {
  const [fechaEgreso, setFechaEgreso] = useState(hoyGT)
  const [convenio, setConvenio] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const elegirConvenio = useCallback((archivo: File | null) => {
    setError(archivo ? validarArchivoDocumento(archivo) : null)
    setConvenio(archivo)
  }, [])

  const registrar = useCallback(async () => {
    const validado = registrarEgresoSchema.safeParse({ fechaEgreso })
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Revisa la fecha de egreso')
      return
    }
    const archivoInvalido = convenio ? validarArchivoDocumento(convenio) : null
    if (archivoInvalido) {
      setError(archivoInvalido)
      return
    }

    setError(null)
    setEnviando(true)
    try {
      await registrarEgreso(expedienteId, validado.data)
    } catch (err) {
      setError(extraerMensajeError(err))
      setEnviando(false)
      return
    }

    // El egreso ya quedó guardado: si el convenio falla no se revierte, se avisa para subirlo después.
    let resultado: ResultadoEgreso = { convenio: 'NO_ADJUNTO' }
    if (convenio) {
      try {
        await subirDocumentoCaso(expedienteId, 'CONVENIO_EGRESO', convenio)
        resultado = { convenio: 'SUBIDO' }
      } catch {
        resultado = { convenio: 'FALLO' }
      }
    }
    setEnviando(false)
    onRegistrado(resultado)
  }, [fechaEgreso, convenio, expedienteId, onRegistrado])

  return { fechaEgreso, setFechaEgreso, elegirConvenio, error, enviando, registrar }
}
