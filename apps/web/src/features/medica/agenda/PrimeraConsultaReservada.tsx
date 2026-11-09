import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CitaMedicaProgramadaDto } from '@akyuam/shared'
import { AvisoCancelarPrimeraCita, AvisoReservaPerdida } from '../../../components/agenda/AvisosReserva'
import { useReservaCaso } from '../../../lib/useReservaCaso'
import { liberarReferencia, liberarReferenciaAlCerrar, reservarReferencia } from '../api/medica.api'
import ModalProgramar from '../compartido/ModalProgramar'
import { RUTAS_MEDICA } from '../rutas'

interface PrimeraConsultaReservadaProps {
  referidoId: string
  /** Día que se propone primero (el abierto en la agenda), si no ya pasó. */
  fechaPreferida: string | null
  onProgramada: (cita: CitaMedicaProgramadaDto) => void
}

/**
 * "Agendar primera consulta" de una referencia del Área de atención. La referencia queda reservada
 * mientras el modal está abierto (las demás ven quién la agenda); la atención se abre al confirmar
 * la cita. Cancelar avisa que nada se agendó y "Salir" vuelve al Área de atención.
 */
export default function PrimeraConsultaReservada({ referidoId, fechaPreferida, onProgramada }: PrimeraConsultaReservadaProps) {
  const navigate = useNavigate()
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const { perdida } = useReservaCaso(referidoId, {
    reservar: () => reservarReferencia(referidoId),
    liberar: () => liberarReferencia(referidoId),
    liberarAlCerrar: () => liberarReferenciaAlCerrar(referidoId),
  })
  // `replace`: "atrás" desde el Área de atención no debe volver a abrir este modal.
  const salir = () => navigate(RUTAS_MEDICA.atencion(), { replace: true })

  if (perdida) {
    return <AvisoReservaPerdida mensaje={perdida} volverEtiqueta="Volver a Área de atención" onVolver={salir} />
  }

  return (
    <>
      <ModalProgramar
        preseleccion={{ referidoId }}
        fechaPreferida={fechaPreferida}
        onCerrar={() => setConfirmandoSalida(true)}
        onProgramada={onProgramada}
      />
      <AvisoCancelarPrimeraCita
        abierto={confirmandoSalida}
        que="consulta"
        onSeguir={() => setConfirmandoSalida(false)}
        onSalir={salir}
      />
    </>
  )
}
