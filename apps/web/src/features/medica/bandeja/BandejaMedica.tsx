import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { LIMITE_BANDEJA_MEDICA, type ReferenciaBandejaMedicaDto } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Drawer from '../../../components/ui/Drawer'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import ContenidoDetalleExpediente from '../../area-atencion/ContenidoDetalleExpediente'
import { listarBandeja } from '../api/medica.api'
import { useContextoMedica } from '../compartido/contexto'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import { useRecargaNovedades } from '../compartido/useRecargaNovedades'
import { RUTAS_MEDICA } from '../rutas'
import TarjetaReferencia from './TarjetaReferencia'

/**
 * Área de atención: referencias de Trabajo Social a Medicina que aún no tienen primera consulta.
 * Al agendarla se abre la atención médica y la usuaria sale de aquí (pasa a Agenda y Pacientes).
 */
export default function BandejaMedica() {
  useTituloPagina({ titulo: 'Área de atención' })
  const navigate = useNavigate()
  const { datos: referencias, error, recargar } = useRecurso(listarBandeja)
  const [expediente, setExpediente] = useState<ReferenciaBandejaMedicaDto | null>(null)
  useRecargaNovedades(recargar)
  const { contadores } = useContextoMedica()
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
              onAgendar={() => navigate(RUTAS_MEDICA.agenda(undefined, referencia.referidoId))}
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
