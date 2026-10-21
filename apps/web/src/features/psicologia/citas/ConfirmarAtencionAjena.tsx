import axios from 'axios'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CODIGO_TRASLAPE_CITA, formatInstanteGT, type CitaPsicologicaDetalle, type ConflictoTraslapeCita } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { asumirAtencionCita } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'

export default function ConfirmarAtencionAjena({ cita, onContinuar }: { cita: CitaPsicologicaDetalle; onContinuar: () => void }) {
  const navigate = useNavigate()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [traslape, setTraslape] = useState<ConflictoTraslapeCita | null>(null)
  async function continuar() {
    if (guardando || !cita.profesional) return
    setGuardando(true)
    setError(null)
    try {
      await asumirAtencionCita(cita.id, { confirmar: true, psicologaAsignadaId: cita.responsable?.id ?? null,
        profesionalCitaId: cita.profesional.id, confirmarTraslape: traslape !== null })
      onContinuar()
    } catch (err) {
      const cuerpo = axios.isAxiosError(err) ? err.response?.data as ConflictoTraslapeCita | undefined : undefined
      if (cuerpo?.codigo === CODIGO_TRASLAPE_CITA) setTraslape(cuerpo)
      else setError(extraerMensajeError(err))
    } finally { setGuardando(false) }
  }
  return <ConfirmModal abierto titulo="Cita asignada a otra psicóloga"
    descripcion={`${cita.ninoNombreCompleto ?? cita.usuariaNombreCompleto} · ${formatInstanteGT(cita.fechaHora)}`}
    confirmarLabel={traslape ? 'Continuar de todos modos' : 'Continuar y atender'} cargando={guardando} error={error}
    onConfirmar={() => void continuar()} onCancelar={() => navigate(RUTAS_PSICOLOGIA.detalleCita(cita.id), { replace: true })}>
    <p className="text-sm text-gray-700">Esta cita está asignada a <strong>{cita.profesional?.nombre}</strong>.
      {cita.responsable && <> El proceso está a cargo de <strong>{cita.responsable.nombre}</strong>.</>}</p>
    <p className="text-sm text-gray-600">Si continúas, quedarás como profesional de esta cita. Se conservarán la responsable del proceso y todas las sesiones anteriores.</p>
    {traslape && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Ya tienes otra cita en ese horario. Cambia la cita o confirma si puedes atenderla de todos modos.
    </div>}
  </ConfirmModal>
}
