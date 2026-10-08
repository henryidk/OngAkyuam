import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import type { ReferenciaBandejaPsicologiaDto } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Drawer from '../../../components/ui/Drawer'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { useRecurso } from '../../../lib/useRecurso'
import ContenidoDetalleExpediente from '../../area-atencion/ContenidoDetalleExpediente'
import { listarBandeja } from '../api/psicologia.api'
import { useContextoPsicologia } from '../compartido/contexto'
import { useReclamarCaso } from '../hooks/useReclamarCaso'
import { RUTAS_PSICOLOGIA } from '../rutas'
import TarjetaReferencia from './TarjetaReferencia'

function textoTotal(total: number): string {
  if (total === 0) return 'Todo al día'
  return `${total} sin tomar · más antiguas primero`
}

/**
 * Área de atención: las usuarias que Trabajo Social refirió a Psicología y que nadie ha tomado.
 * La lista es común a todas las psicólogas; al tomar un caso pasa a ser de quien lo tomó y sale
 * de aquí. La primera cita se programa después, desde la agenda.
 */
export default function BandejaPsicologia() {
  useTituloPagina({ titulo: 'Área de atención' })
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const { recargarResumen, versionNovedades } = useContextoPsicologia()
  const { datos: referencias, error, recargar } = useRecurso(listarBandeja)
  const { reclamandoId, error: errorReclamar, reclamar } = useReclamarCaso()
  const [enDetalle, setEnDetalle] = useState<ReferenciaBandejaPsicologiaDto | null>(null)

  // Llegó una referencia u otra psicóloga tomó un caso mientras la pantalla está abierta: se
  // vuelve a pedir sin desmontar lo que ya se ve. La primera versión es la de la carga inicial.
  const versionVista = useRef(versionNovedades)
  useEffect(() => {
    if (versionVista.current === versionNovedades) return
    versionVista.current = versionNovedades
    void recargar()
  }, [versionNovedades, recargar])

  function tomar(referencia: ReferenciaBandejaPsicologiaDto) {
    void reclamar(referencia.referidoId, {
      alTomar: () => {
        recargarResumen()
        mostrar('Caso tomado. Prográmale la primera cita.')
        navigate(RUTAS_PSICOLOGIA.agenda(undefined, referencia.referidoId))
      },
      alPerderlo: () => {
        void recargar()
        recargarResumen()
      },
    })
  }

  return (
    <div className="mx-auto max-w-[920px] space-y-5">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-semibold text-gray-900">
          {referencias ? textoTotal(referencias.length) : 'Referencias sin tomar'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Usuarias que Trabajo Social refirió a Psicología. Al tomar un caso pasa a ser tuyo; después le programas la
          primera cita desde la agenda.
        </p>
      </div>

      {errorReclamar && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {errorReclamar}
        </p>
      )}

      {error ? (
        <ErrorVista
          mensaje={error.mensaje}
          sinPermiso={error.sinPermiso}
          recurso="esta bandeja"
          onReintentar={() => void recargar()}
        />
      ) : !referencias ? (
        <Esqueleto />
      ) : referencias.length === 0 ? (
        <EmptyState
          Icono={Inbox}
          titulo="No hay referencias pendientes"
          descripcion="Las nuevas aparecerán aquí cuando Trabajo Social refiera una usuaria a Psicología."
        />
      ) : (
        <div className="space-y-3">
          {referencias.map((referencia) => (
            <TarjetaReferencia
              key={referencia.referidoId}
              referencia={referencia}
              tomando={reclamandoId === referencia.referidoId}
              deshabilitada={reclamandoId !== null}
              onTomar={() => tomar(referencia)}
              onVerExpediente={() => setEnDetalle(referencia)}
            />
          ))}
        </div>
      )}

      <Drawer
        abierto={enDetalle !== null}
        titulo={enDetalle?.usuariaNombreCompleto ?? ''}
        subtitulo={enDetalle ? `Expediente ${enDetalle.expedienteNumero}` : undefined}
        onCerrar={() => setEnDetalle(null)}
      >
        {enDetalle && <ContenidoDetalleExpediente expedienteId={enDetalle.expedienteId} />}
      </Drawer>
    </div>
  )
}
