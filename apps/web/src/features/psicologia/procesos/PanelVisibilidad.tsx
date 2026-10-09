import { useState } from 'react'
import type { ProcesoPsicologiaDetalle } from '@akyuam/shared'
import Switch from '../../../components/ui/Switch'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { actualizarVisibilidadProceso } from '../api/psicologia.api'

type Visibilidad = ProcesoPsicologiaDetalle['visibilidad']

const AREAS: { campo: keyof Visibilidad; nombre: string }[] = [
  { campo: 'visibleJuridico', nombre: 'Jurídico' },
  { campo: 'visibleMedica', nombre: 'Médica' },
]

interface PanelVisibilidadProps {
  proceso: ProcesoPsicologiaDetalle
  /** Se guardó, o el servidor avisó que la versión cambió: hay que volver a leer el proceso. */
  onCambio: () => void
}

/**
 * Qué otras áreas ven la etapa, las fechas y los documentos del proceso. Trabajo Social los ve
 * siempre; las notas de sesión no las ve ninguna.
 */
export default function PanelVisibilidad({ proceso, onCambio }: PanelVisibilidadProps) {
  const { mostrar } = useToast()
  const [guardando, setGuardando] = useState(false)
  // Lo recién elegido se muestra de inmediato; deja de valer en cuanto llega la versión nueva.
  const [elegido, setElegido] = useState<{ version: number; valores: Visibilidad } | null>(null)
  const valores = elegido?.version === proceso.version ? elegido.valores : proceso.visibilidad
  const editable = proceso.accionesDisponibles.includes('EDITAR_VISIBILIDAD')

  async function cambiar(campo: keyof Visibilidad, valor: boolean) {
    if (guardando) return
    const nuevos = { ...valores, [campo]: valor }
    setElegido({ version: proceso.version, valores: nuevos })
    setGuardando(true)
    try {
      await actualizarVisibilidadProceso(proceso.id, { ...nuevos, version: proceso.version })
      mostrar('Visibilidad actualizada')
    } catch (err) {
      setElegido(null)
      mostrar(extraerMensajeError(err), 'error')
    } finally {
      setGuardando(false)
      onCambio()
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <h3 className="text-sm font-semibold text-gray-900">Visibilidad del proceso</h3>
      <p className="mt-1 text-xs text-gray-500">
        Las notas de sesión son privadas. Elige qué áreas pueden ver etapa, fechas y documentos.
      </p>
      <ul className="mt-3 divide-y divide-gray-100">
        {/* Texto fijo, no un interruptor: esto no se puede cambiar. */}
        <li className="py-2">
          <p className="text-[13px] text-gray-900">Trabajo Social · siempre ve etapa y fechas</p>
          <p className="mt-0.5 text-xs text-gray-500">
            También la próxima cita y los documentos. No se puede cambiar; las notas de sesión no las ve.
          </p>
        </li>
        {AREAS.map(({ campo, nombre }) => (
          <li key={campo} className="flex items-center justify-between gap-3 py-2">
            <span className="text-[13px] text-gray-900">{nombre}</span>
            {editable ? (
              <Switch
                encendido={valores[campo]}
                onChange={(valor) => void cambiar(campo, valor)}
                ariaLabel={`${nombre} ve el proceso`}
                etiqueta={valores[campo] ? 'Visible' : 'Privado'}
              />
            ) : (
              <span className="text-[13px] font-medium text-gray-600">{valores[campo] ? 'Visible' : 'Privado'}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
