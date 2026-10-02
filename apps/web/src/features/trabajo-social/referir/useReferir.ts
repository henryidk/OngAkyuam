import { useCallback, useEffect, useState } from 'react'
import {
  referirSchema,
  type AreaAtencion,
  type FilaDocumentoCaso,
  type PrioridadReferido,
  type ProfesionalArea,
  type ReferidoCreado,
  type TipoDocumentoTrabajoSocial,
} from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarDocumentosCaso, listarProfesionales, referirCaso } from '../api/trabajoSocial.api'

/** Privado por defecto: solo se comparte de entrada lo que el área necesita para empezar (§5.3). */
const DOCUMENTOS_VISIBLES_POR_DEFECTO: TipoDocumentoTrabajoSocial[] = ['ACCIONES_REALIZADAS']

/**
 * Estado del modal Referir. El contrato del backend permite referir a Psicología sin
 * profesional (queda en "Referencias sin tomar"), pero desde este modal se exige elegirla para
 * que la usuaria no quede esperando en una cola sin dueña.
 */
export function useReferir(
  expedienteId: string,
  areasReferidas: AreaAtencion[],
  onReferido: (referido: ReferidoCreado) => void,
  areaInicial?: AreaAtencion,
) {
  const [area, setAreaState] = useState<AreaAtencion | null>(
    areaInicial && !areasReferidas.includes(areaInicial) ? areaInicial : null,
  )
  const [profesionalId, setProfesionalId] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadReferido>('NORMAL')
  const [motivo, setMotivo] = useState('')
  const [datosCaso, setDatosCaso] = useState(true)
  const [documentosVisibles, setDocumentosVisibles] = useState<TipoDocumentoTrabajoSocial[]>([])

  const [documentos, setDocumentos] = useState<FilaDocumentoCaso[] | null>(null)
  const [profesionales, setProfesionales] = useState<ProfesionalArea[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    listarDocumentosCaso(expedienteId)
      .then(({ filas }) => {
        if (cancelado) return
        setDocumentos(filas)
        setDocumentosVisibles(
          filas
            .filter((fila) => fila.estado === 'SUBIDO' && DOCUMENTOS_VISIBLES_POR_DEFECTO.includes(fila.tipo))
            .map((fila) => fila.tipo),
        )
      })
      .catch((err: unknown) => {
        if (!cancelado) setErrorCarga(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId])

  useEffect(() => {
    if (!area || area === 'JURIDICO') {
      setProfesionales(null)
      return
    }
    let cancelado = false
    setProfesionales(null)
    listarProfesionales(area)
      .then((lista) => {
        if (!cancelado) setProfesionales(lista)
      })
      .catch((err: unknown) => {
        if (!cancelado) setErrorCarga(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [area])

  const setArea = useCallback(
    (nueva: AreaAtencion) => {
      if (areasReferidas.includes(nueva)) return
      setAreaState(nueva)
      setProfesionalId('')
      setError(null)
    },
    [areasReferidas],
  )

  const alternarDocumento = useCallback((tipo: TipoDocumentoTrabajoSocial, visible: boolean) => {
    setDocumentosVisibles((actuales) =>
      visible ? [...new Set([...actuales, tipo])] : actuales.filter((actual) => actual !== tipo),
    )
  }, [])

  const referir = useCallback(async () => {
    if (!area) {
      setError('Elige el área a la que vas a referir')
      return
    }
    if (area === 'PSICOLOGIA' && !profesionalId) {
      setError('Elige la psicóloga que atenderá a la usuaria')
      return
    }
    const validado = referirSchema.safeParse({
      area,
      profesionalAsignadoId: profesionalId || undefined,
      prioridad,
      motivo,
      visibilidad: { datosCaso, documentos: documentosVisibles },
    })
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Revisa los datos de la referencia')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      onReferido(await referirCaso(expedienteId, validado.data))
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setEnviando(false)
    }
  }, [area, profesionalId, prioridad, motivo, datosCaso, documentosVisibles, expedienteId, onReferido])

  return {
    area,
    setArea,
    profesionalId,
    setProfesionalId,
    prioridad,
    setPrioridad,
    motivo,
    setMotivo,
    datosCaso,
    setDatosCaso,
    documentosVisibles,
    alternarDocumento,
    documentos,
    profesionales,
    errorCarga,
    error,
    enviando,
    referir,
  }
}
