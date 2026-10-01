import { useCallback, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ETIQUETAS_AREA_ATENCION, type AreaAtencion, type ReferidoCreado } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import ModalEgreso from '../egreso/ModalEgreso'
import { textoEgresoRegistrado, type ResultadoEgreso } from '../egreso/textoEgreso'
import ModalReferir from '../referir/ModalReferir'
import type { ContextoFicha } from './contextoFicha'
import EncabezadoFicha from './EncabezadoFicha'
import { nombreCompleto } from './textoUsuaria'
import { useFichaUsuaria } from './useFichaUsuaria'

/**
 * Ficha de la usuaria como layout (plan §5.1): encabezado fijo y una pestaña por ruta anidada.
 * "Referir" vive aquí porque se abre desde el encabezado y desde el Resumen, y siempre sobre el
 * caso activo; "Registrar egreso", por lo mismo.
 */
export default function FichaUsuaria() {
  const { usuariaId = '' } = useParams()
  const { usuaria, setUsuaria, error, recargar } = useFichaUsuaria(usuariaId)
  const { mostrar } = useToast()
  const [referir, setReferir] = useState<{ area?: AreaAtencion } | null>(null)
  const [egresoAbierto, setEgresoAbierto] = useState(false)
  const [version, setVersion] = useState(0)

  const abrirReferir = useCallback((area?: AreaAtencion) => setReferir({ area }), [])

  const onReferido = useCallback(
    (referido: ReferidoCreado) => {
      setReferir(null)
      mostrar(`Referida a ${ETIQUETAS_AREA_ATENCION[referido.area]} · ya aparece en su bandeja`)
      setVersion((actual) => actual + 1)
      void recargar()
    },
    [recargar, mostrar],
  )

  const onEgresoRegistrado = useCallback(
    (resultado: ResultadoEgreso) => {
      setEgresoAbierto(false)
      mostrar(textoEgresoRegistrado(resultado))
      setVersion((actual) => actual + 1)
      void recargar()
    },
    [recargar, mostrar],
  )

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link to="/trabajo-social/usuarias" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
          Volver a Usuarias
        </Link>
      </div>
    )
  }

  if (!usuaria) {
    return <p className="text-sm text-gray-500">Cargando ficha de la usuaria…</p>
  }

  const casoActual = usuaria.casos[0] ?? null
  const contexto: ContextoFicha = { usuaria, onUsuariaActualizada: setUsuaria, abrirReferir, version }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <nav aria-label="Migas" className="text-xs text-gray-500">
        <Link to="/trabajo-social/usuarias" className="hover:text-gray-800 hover:underline">
          Usuarias
        </Link>
        {' / '}
        <span className="tabular-nums text-gray-700">
          {casoActual ? `Expediente ${casoActual.numero}` : nombreCompleto(usuaria)}
        </span>
      </nav>

      <EncabezadoFicha
        usuaria={usuaria}
        onReferir={() => abrirReferir()}
        onRegistrarEgreso={() => setEgresoAbierto(true)}
      />

      <Outlet context={contexto} />

      {referir && casoActual && (
        <ModalReferir
          expedienteId={casoActual.id}
          numeroExpediente={casoActual.numero}
          nombreUsuaria={nombreCompleto(usuaria)}
          areasReferidas={casoActual.areasReferidas}
          areaInicial={referir.area}
          onCerrar={() => setReferir(null)}
          onReferido={onReferido}
        />
      )}

      {egresoAbierto && casoActual && (
        <ModalEgreso
          expedienteId={casoActual.id}
          numeroExpediente={casoActual.numero}
          onCerrar={() => setEgresoAbierto(false)}
          onRegistrado={onEgresoRegistrado}
        />
      )}
    </div>
  )
}
