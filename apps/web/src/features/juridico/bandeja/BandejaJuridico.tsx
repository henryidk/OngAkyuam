import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { bandejaJuridicoQuerySchema, type ReferenciaBandejaDto, type VistaBandejaJuridico } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import { listarBandeja } from '../api/juridico.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
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
    descripcion: 'Aquí quedan las referencias devueltas a Trabajo Social con su motivo.',
  },
}

function tituloVista(vista: VistaBandejaJuridico, total: number | null): string {
  if (total === null) return vista === 'pendientes' ? 'Referencias pendientes' : 'Referencias devueltas'
  if (vista === 'devueltas') return total === 1 ? '1 referencia devuelta' : `${total} referencias devueltas`
  if (total === 0) return 'Todo al día'
  return total === 1 ? '1 referencia espera atención' : `${total} referencias esperan atención`
}

const DESCRIPCION_VISTA: Record<VistaBandejaJuridico, string> = {
  pendientes: 'Al atender un caso, los procesos que abras quedan En proceso automáticamente.',
  devueltas: 'Referencias que Jurídico devolvió a Trabajo Social, con su motivo.',
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

  function alDevolver() {
    setADevolver(null)
    mostrar('Referencia devuelta a Trabajo Social')
    void recargar()
    recargarResumen()
  }

  return (
    <div className="mx-auto max-w-[920px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-[22px] font-semibold text-gray-900">{tituloVista(vista, referencias?.length ?? null)}</h2>
          <p className="mt-1 text-sm text-gray-600">{DESCRIPCION_VISTA[vista]}</p>
        </div>
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
              onDevolver={() => setADevolver(referencia)}
            />
          ))}
        </div>
      )}

      {aDevolver && <ModalDevolver referencia={aDevolver} onCerrar={() => setADevolver(null)} onDevuelta={alDevolver} />}
    </div>
  )
}
