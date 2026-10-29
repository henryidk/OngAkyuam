import { useCallback, useState } from 'react'
import type { AccionAudiencia, ProximaAudienciaDto } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { listarAudienciasProceso } from '../api/audiencias.api'
import type { ModalAudiencia } from './caso'

/**
 * La única acción que admite la próxima audiencia de un proceso: antes de la hora se reprograma;
 * desde la hora solo se registra el resultado (y si no se realizó, de ahí sale la nueva fecha).
 */
export function accionProximaAudiencia(proxima: Pick<ProximaAudienciaDto, 'estadoVisible'>): AccionAudiencia {
  return proxima.estadoVisible === 'PENDIENTE_RESULTADO' ? 'REGISTRAR_RESULTADO' : 'REPROGRAMAR'
}

/**
 * Abre el modal de la próxima audiencia desde Procesos o la ficha. Ahí solo se tiene un resumen;
 * el modal necesita la audiencia completa con sus acciones vigentes, así que se pide al abrirlo
 * (y el backend vuelve a validar al guardar). `cargandoId` es la audiencia que se está pidiendo.
 */
export function useAccionProximaAudiencia(abrirAudiencia: (modal: ModalAudiencia) => void) {
  const { mostrar } = useToast()
  const [cargandoId, setCargandoId] = useState<string | null>(null)

  const abrir = useCallback(
    async (procesoId: string, proxima: Pick<ProximaAudienciaDto, 'id' | 'estadoVisible'>) => {
      const accion = accionProximaAudiencia(proxima)
      setCargandoId(proxima.id)
      try {
        const audiencias = await listarAudienciasProceso(procesoId)
        const audiencia = audiencias.find((item) => item.id === proxima.id)
        if (audiencia?.accionesDisponibles.includes(accion)) {
          abrirAudiencia({ tipo: accion, audiencia })
        } else {
          mostrar('La audiencia cambió mientras tanto. Revise la pestaña Audiencias.', 'info')
        }
      } catch (error) {
        mostrar(extraerMensajeError(error), 'error')
      } finally {
        setCargandoId(null)
      }
    },
    [abrirAudiencia, mostrar],
  )

  return { abrir, cargandoId }
}
