import axios from 'axios'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CasoPorReasignarDto } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { tomarCasoPorReasignar } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'
import TarjetaPorReasignar from './TarjetaPorReasignar'

interface SeccionPorReasignarProps {
  casos: CasoPorReasignarDto[]
  /** Se tomó un caso o la lista dejó de ser cierta: hay que volver a pedirla. */
  onCambio: () => void
}

function avisoCitas(cantidad: number): string {
  if (cantidad === 0) return ''
  return cantidad === 1 ? ' Se cancelará 1 cita programada.' : ` Se cancelarán ${cantidad} citas programadas.`
}

/**
 * Casos y procesos abiertos cuya psicóloga ya no trabaja en el sistema. Solo aparece cuando hay
 * alguno. Tomarlo es definitivo y cancela las citas pendientes, por eso se confirma.
 */
export default function SeccionPorReasignar({ casos, onCambio }: SeccionPorReasignarProps) {
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const [porTomar, setPorTomar] = useState<CasoPorReasignarDto | null>(null)
  const [tomando, setTomando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (casos.length === 0) return null

  function cerrar() {
    setPorTomar(null)
    setError(null)
  }

  async function confirmar(caso: CasoPorReasignarDto) {
    setError(null)
    setTomando(true)
    try {
      const tomado = await tomarCasoPorReasignar(caso.procesoId)
      onCambio()
      if (tomado.referidoIdPorAgendar) {
        mostrar('Caso tomado. Prográmale la primera cita.')
        navigate(RUTAS_PSICOLOGIA.agenda(undefined, tomado.referidoIdPorAgendar))
      } else {
        mostrar('Proceso tomado: ahora es tuyo. Prográmale su próxima cita.')
        navigate(RUTAS_PSICOLOGIA.proceso(tomado.procesoId))
      }
    } catch (err) {
      setError(extraerMensajeError(err))
      // 409: otra psicóloga lo tomó primero; la lista que se ve ya no es cierta.
      if (axios.isAxiosError(err) && err.response?.status === 409) onCambio()
    } finally {
      setTomando(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-gray-900">Casos por reasignar · {casos.length}</h2>
        <p className="mt-1 text-sm text-gray-600">
          Su psicóloga ya no tiene la cuenta activa. Quien tome uno pasa a llevarlo, con todo su historial; las citas
          que estaban programadas no se heredan.
        </p>
      </div>

      {casos.map((caso) => (
        <TarjetaPorReasignar
          key={caso.procesoId}
          caso={caso}
          deshabilitada={tomando}
          onTomar={() => setPorTomar(caso)}
        />
      ))}

      <ConfirmModal
        abierto={porTomar !== null}
        titulo={porTomar?.codigo ? 'Tomar este proceso' : 'Tomar este caso'}
        descripcion={
          porTomar
            ? `${porTomar.usuariaNombreCompleto} pasará a ser tu usuaria y verás todo lo trabajado por ${porTomar.psicologaAnterior}.${avisoCitas(porTomar.citasProgramadas)}`
            : undefined
        }
        confirmarLabel="Tomar caso"
        cargando={tomando}
        error={error}
        onConfirmar={() => porTomar && void confirmar(porTomar)}
        onCancelar={cerrar}
      />
    </section>
  )
}
