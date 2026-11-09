import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { LIMITE_BANDEJA_MEDICA, RENOVACION_RESERVA_CASO_MS, type ReferenciaBandejaMedicaDto } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Drawer from '../../../components/ui/Drawer'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useEmpezarReserva } from '../../../lib/useEmpezarReserva'
import { useRecurso } from '../../../lib/useRecurso'
import ContenidoDetalleExpediente from '../../area-atencion/ContenidoDetalleExpediente'
import { listarBandeja, reservarReferencia } from '../api/medica.api'
import { useContextoMedica } from '../compartido/contexto'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../rutas'
import TarjetaReferencia from './TarjetaReferencia'

/**
 * Área de atención: referencias de Trabajo Social a Medicina que aún no tienen primera consulta.
 * "Agendar primera consulta" reserva la referencia y abre la agenda; al confirmar la cita se abre
 * la atención médica y la usuaria sale de aquí (pasa a Agenda y Pacientes). Si se cancela, sigue
 * aquí. Mientras otra persona la agenda, su tarjeta lo dice y no se puede empezar a la vez.
 */
export default function BandejaMedica() {
  useTituloPagina({ titulo: 'Área de atención' })
  const navigate = useNavigate()
  const { datos: referencias, error, recargar } = useRecurso(listarBandeja)
  const [expediente, setExpediente] = useState<ReferenciaBandejaMedicaDto | null>(null)
  useRecargaNovedades(recargar)
  const { contadores, recargarContadores } = useContextoMedica()
  const { reservandoId, error: errorReservar, empezar } = useEmpezarReserva()

  // Una reserva ajena que vence sin soltarse (pestaña cerrada sin red, sin luz) no avisa a nadie:
  // mientras haya alguna a la vista, la lista se vuelve a pedir para que el botón se libere solo.
  const hayReservaAjena = referencias?.some((referencia) => referencia.reserva && !referencia.reserva.propia) ?? false
  useEffect(() => {
    if (!hayReservaAjena) return
    const intervalo = window.setInterval(() => void recargar(), RENOVACION_RESERVA_CASO_MS)
    return () => window.clearInterval(intervalo)
  }, [hayReservaAjena, recargar])

  function agendar({ referidoId }: ReferenciaBandejaMedicaDto) {
    void empezar(referidoId, () => reservarReferencia(referidoId), {
      alReservar: () => navigate(RUTAS_MEDICA.agenda(undefined, referidoId)),
      // Otra persona la está agendando o ya la agendó: la lista que se ve ya no es cierta.
      alPerderla: () => {
        void recargar()
        recargarContadores()
      },
    })
  }
  // La bandeja trae como mucho LIMITE_BANDEJA_MEDICA; el contador del menú cuenta todas.
  const total = referencias ? Math.max(referencias.length, contadores?.areaAtencion ?? 0) : 0
  const recortada = referencias !== null && referencias.length >= LIMITE_BANDEJA_MEDICA && total > referencias.length

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <EncabezadoPagina
        eyebrow="Bandeja de entrada"
        titulo="Área de atención"
        descripcion={
          <>
            Referencias de Trabajo Social a Medicina. Al <strong className="font-semibold text-texto">agendar la primera consulta</strong> se
            abre la atención médica y la usuaria pasa a Agenda y Pacientes.
          </>
        }
        extremo={
          referencias && referencias.length > 0 ? (
            <p className="text-[13px] text-texto-suave">{total} por agendar · más antiguas primero</p>
          ) : undefined
        }
      />

      {errorReservar && (
        <p role="alert" className="rounded-lg border border-estado-error-borde bg-estado-error-fondo px-3.5 py-2.5 text-sm text-estado-error">
          {errorReservar}
        </p>
      )}

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta bandeja" onReintentar={() => void recargar()} />
      ) : !referencias ? (
        <Esqueleto />
      ) : referencias.length === 0 ? (
        <EmptyState
          Icono={Inbox}
          titulo="No hay referencias pendientes"
          descripcion="Las nuevas aparecerán aquí cuando Trabajo Social refiera una usuaria a Medicina."
        />
      ) : (
        <div className="space-y-3">
          {referencias.map((referencia) => (
            <TarjetaReferencia
              key={referencia.referidoId}
              referencia={referencia}
              onVerExpediente={() => setExpediente(referencia)}
              onAgendar={() => agendar(referencia)}
              reservando={reservandoId === referencia.referidoId}
              deshabilitada={reservandoId !== null}
            />
          ))}
          {recortada && (
            <p className="rounded-lg border border-borde bg-white px-4 py-3 text-[13px] text-texto-suave">
              Se muestran las {referencias.length} más antiguas de {total}. Al agendarlas van entrando las siguientes.
            </p>
          )}
        </div>
      )}

      <Drawer
        abierto={expediente !== null}
        titulo={expediente?.usuariaNombreCompleto ?? ''}
        subtitulo={expediente ? `Exp. ${expediente.expedienteNumero} · lo que Trabajo Social compartió` : undefined}
        onCerrar={() => setExpediente(null)}
      >
        {expediente && <ContenidoDetalleExpediente expedienteId={expediente.expedienteId} />}
      </Drawer>
    </div>
  )
}
