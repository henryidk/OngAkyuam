import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AvisoCancelarPrimeraCita, AvisoReservaPerdida } from '../../../components/agenda/AvisosReserva'
import { useRecurso } from '../../../lib/useRecurso'
import { useReservaCaso } from '../../../lib/useReservaCaso'
import {
  liberarReferencia,
  liberarReferenciaAlCerrar,
  obtenerReferenciaParaAgendar,
  reservarReferencia,
} from '../api/psicologia.api'
import ModalProgramarCita from '../citas/ModalProgramarCita'
import { RUTAS_PSICOLOGIA, type OrigenPrimeraCita } from '../rutas'

interface PrimeraCitaReservadaProps {
  referidoId: string
  origen: OrigenPrimeraCita
  fechaInicial: string
  onGuardada: (fecha: string, mensaje: string) => void
}

/**
 * La primera cita de una referencia sin tomar, abierta desde el Área de atención o la ficha. La
 * referencia queda reservada mientras esto está abierto (las demás ven quién la agenda); el caso
 * se toma al confirmar la cita. Cancelar avisa que nada se tomó y "Salir" vuelve a donde se pidió.
 */
export default function PrimeraCitaReservada({ referidoId, origen, fechaInicial, onGuardada }: PrimeraCitaReservadaProps) {
  const navigate = useNavigate()
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const { datos: referencia, error } = useRecurso(
    useCallback(() => obtenerReferenciaParaAgendar(referidoId), [referidoId]),
  )
  const { perdida } = useReservaCaso(referidoId, {
    reservar: () => reservarReferencia(referidoId, 'AGENDANDO'),
    liberar: () => liberarReferencia(referidoId),
    liberarAlCerrar: () => liberarReferenciaAlCerrar(referidoId),
  })

  // A la ficha solo si se sabe de quién es; si la referencia no cargó, al Área de atención.
  const aLaFicha = origen === 'ficha' && referencia !== null
  // `replace`: "atrás" desde el origen no debe volver a abrir este modal.
  const salir = () =>
    navigate(aLaFicha ? RUTAS_PSICOLOGIA.usuaria(referencia.usuariaId) : RUTAS_PSICOLOGIA.atencion(), { replace: true })

  const noSePuede = perdida ?? error?.mensaje
  if (noSePuede) {
    return (
      <AvisoReservaPerdida
        mensaje={noSePuede}
        volverEtiqueta={aLaFicha ? 'Volver a la ficha' : 'Volver a Área de atención'}
        onVolver={salir}
      />
    )
  }
  if (!referencia) return null

  return (
    <>
      <ModalProgramarCita
        destino={{ tipo: 'PRIMERA', caso: referencia }}
        fechaInicial={fechaInicial}
        onCerrar={() => setConfirmandoSalida(true)}
        onGuardada={onGuardada}
      />
      <AvisoCancelarPrimeraCita
        abierto={confirmandoSalida}
        que="cita"
        onSeguir={() => setConfirmandoSalida(false)}
        onSalir={salir}
      />
    </>
  )
}
