import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { bandejaJuridicoQuerySchema, type ReferenciaBandejaDto, type VistaBandejaJuridico } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import DrawerDetalleExpediente from '../../area-atencion/DrawerDetalleExpediente'
import { listarBandeja } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import ModalDevolver from './ModalDevolver'
import TarjetaReferencia from './TarjetaReferencia'

const VISTAS: { vista: VistaBandejaJuridico; etiqueta: string }[] = [
  { vista: 'pendientes', etiqueta: 'Pendientes' },
  { vista: 'devueltas', etiqueta: 'Devueltas' },
]

const TEXTO_VACIO: Record<VistaBandejaJuridico, { titulo: string; descripcion: string }> = {
  pendientes: {
    titulo: 'No hay referencias pendientes',
    descripcion: 'Cuando Trabajo Social refiera una usuaria a Jurídico, aparecerá aquí.',
  },
  devueltas: {
    titulo: 'No hay referencias devueltas',
    descripcion: 'Aquí quedan las referencias que se devolvieron a Trabajo Social con su observación.',
  },
}

/** Área de atención: solo recibe y distribuye. El registro de procesos se hace en el asistente. */
export default function BandejaJuridico() {
  useTituloPagina({ titulo: 'Área de atención' })
  const { mostrar } = useToast()
  const { resumen, recargarResumen } = useContextoJuridico()
  const [searchParams, setSearchParams] = useSearchParams()
  // La vista vive en la URL: se puede enlazar y el botón Atrás funciona.
  const { vista } = bandejaJuridicoQuerySchema.catch({ vista: 'pendientes' }).parse({
    vista: searchParams.get('vista') ?? undefined,
  })

  const cargar = useCallback(() => listarBandeja(vista), [vista])
  const { datos: referencias, error, recargar } = useRecurso(cargar)

  const [aDevolver, setADevolver] = useState<ReferenciaBandejaDto | null>(null)
  const [expedienteAbiertoId, setExpedienteAbiertoId] = useState<string | null>(null)

  function alDevolver() {
    setADevolver(null)
    mostrar('Referencia devuelta a Trabajo Social')
    void recargar()
    recargarResumen()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-gray-600">
          Usuarias referidas por Trabajo Social. Aquí solo se revisa y distribuye cada referencia. El registro y la
          gestión de procesos se hacen en{' '}
          <Link to={RUTAS_JURIDICO.procesos()} className="font-medium text-brand-700 hover:underline">
            Procesos
          </Link>
          .
        </p>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {VISTAS.map((opcion) => {
            const activa = opcion.vista === vista
            return (
              <button
                key={opcion.vista}
                type="button"
                aria-pressed={activa}
                onClick={() => setSearchParams(opcion.vista === 'pendientes' ? {} : { vista: opcion.vista })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  activa ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opcion.etiqueta}
                {opcion.vista === 'pendientes' && !!resumen?.referenciasPendientes && ` (${resumen.referenciasPendientes})`}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta bandeja" onReintentar={() => void recargar()} />
      ) : !referencias ? (
        <Esqueleto />
      ) : referencias.length === 0 ? (
        <EmptyState Icono={Inbox} titulo={TEXTO_VACIO[vista].titulo} descripcion={TEXTO_VACIO[vista].descripcion} />
      ) : (
        <div className="space-y-3">
          {referencias.map((referencia) => (
            <TarjetaReferencia
              key={referencia.referidoId}
              referencia={referencia}
              onVerDatos={() => setExpedienteAbiertoId(referencia.expedienteId)}
              onDevolver={() => setADevolver(referencia)}
            />
          ))}
        </div>
      )}

      {aDevolver && <ModalDevolver referencia={aDevolver} onCerrar={() => setADevolver(null)} onDevuelta={alDevolver} />}
      <DrawerDetalleExpediente expedienteId={expedienteAbiertoId} onCerrar={() => setExpedienteAbiertoId(null)} />
    </div>
  )
}
