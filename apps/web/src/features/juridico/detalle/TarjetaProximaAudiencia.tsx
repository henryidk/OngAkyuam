import { Link } from 'react-router-dom'
import { hoyGT, type ProcesoDetalle } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import type { ModalAudiencia } from '../audiencias/caso'
import { useAccionProximaAudiencia } from '../audiencias/useAccionProximaAudiencia'
import { formatHora12 } from '../compartido/hora12'
import { RUTAS_JURIDICO } from '../rutas'
import { bloqueFecha, textoCuando } from './formatoBitacora'

interface TarjetaProximaAudienciaProps {
  proceso: ProcesoDetalle
  abrirAudiencia: (modal: ModalAudiencia) => void
}

/**
 * Lo siguiente que tiene agendado el proceso, arriba de la bitácora. Si ya pasó la hora y falta el
 * resultado, la tarjeta lo dice en ámbar y ofrece registrarlo; si no, ofrece reprogramarla.
 */
export default function TarjetaProximaAudiencia({ proceso, abrirAudiencia }: TarjetaProximaAudienciaProps) {
  const { abrir, cargandoId } = useAccionProximaAudiencia(abrirAudiencia)
  const proxima = proceso.proximaAudiencia
  if (!proxima) return null

  const programada = proceso.audienciasProgramadas.find((audiencia) => audiencia.id === proxima.id)
  const pendiente = proxima.estadoVisible === 'PENDIENTE_RESULTADO'
  const { mes, dia, diaSemana } = bloqueFecha(proxima.fecha)
  const cuando = textoCuando(proxima.fecha, hoyGT())

  return (
    <section
      aria-label={pendiente ? 'Audiencia sin resultado' : 'Próxima audiencia'}
      className={`flex flex-wrap items-center gap-4 rounded-xl border bg-white px-5 py-4 ${
        pendiente ? 'border-[#ecd9b8]' : 'border-[#e3d8f1]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`flex w-[58px] flex-none flex-col items-center rounded-[10px] py-1.5 text-white ${
          pendiente ? 'bg-[#8a5a14]' : 'bg-brand-600'
        }`}
      >
        <span className="text-[11px] font-semibold tracking-wider">{mes}</span>
        <span className="text-2xl leading-tight font-bold tabular-nums">{dia}</span>
        <span className="text-[11px]">{diaSemana}</span>
      </div>
      <div className="min-w-0 flex-1 basis-[220px] space-y-0.5">
        <p className={`text-[13px] font-semibold ${pendiente ? 'text-[#8a5a14]' : 'text-brand-700'}`}>
          {pendiente ? `Falta registrar el resultado · ${cuando}` : `Próxima audiencia · ${cuando}`}
        </p>
        <p className="text-base font-semibold text-gray-900">
          {programada?.descripcion ?? 'Audiencia'} · <span className="tabular-nums">{formatHora12(proxima.hora)}</span>
        </p>
        {programada && <p className="text-[13px] text-gray-600">Responsable: {programada.responsable.nombre}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variante="secondary" tamano="md" onClick={() => void abrir(proceso.id, proxima)} cargando={cargandoId === proxima.id}>
          {pendiente ? 'Registrar resultado' : 'Reprogramar'}
        </Button>
        <Link
          to={RUTAS_JURIDICO.audienciasProceso(proceso.id, { audienciaId: proxima.id })}
          className="rounded px-1 py-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          Ver audiencia
        </Link>
      </div>
    </section>
  )
}
