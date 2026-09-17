import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gavel } from 'lucide-react'
import type { PersonalDto, ProcesoResumen } from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import ContenidoDetalleExpediente from '../area-atencion/ContenidoDetalleExpediente'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import EmptyState from '../../components/ui/EmptyState'
import FormularioNuevoProceso from './FormularioNuevoProceso'
import TarjetaProceso from './TarjetaProceso'

interface EspacioTrabajoCasoProps {
  expedienteId: string
}

export default function EspacioTrabajoCaso({ expedienteId }: EspacioTrabajoCasoProps) {
  const [procesos, setProcesos] = useState<ProcesoResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [personal, setPersonal] = useState<PersonalDto[]>([])
  const [drawerAbierto, setDrawerAbierto] = useState(false)

  const cargarProcesos = useCallback(async () => {
    try {
      const { data } = await api.get<ProcesoResumen[]>(`/juridico/expedientes/${expedienteId}/procesos`)
      setProcesos(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    void cargarProcesos()
    api
      .get<PersonalDto[]>('/personal', { params: { area: 'JURIDICO' } })
      .then(({ data }) => setPersonal(data))
      .catch(() => undefined)
  }, [expedienteId, cargarProcesos])

  const abogadas = personal.filter((item) => item.tipo === 'ABOGADA' && item.activo)
  const procuradoras = personal.filter((item) => item.tipo === 'PROCURADORA' && item.activo)

  function onProcesoCreado() {
    setDrawerAbierto(false)
    void cargarProcesos()
  }

  return (
    <div className="space-y-4">
      <Link to="/juridico" className="text-sm font-medium text-brand-600 hover:underline">
        ← Volver al listado
      </Link>

      <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-800">
          Datos de la usuaria
        </summary>
        <div className="border-t border-gray-100 p-4">
          <ContenidoDetalleExpediente expedienteId={expedienteId} />
        </div>
      </details>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Procesos</h2>
        <Button onClick={() => setDrawerAbierto(true)}>Nuevo proceso</Button>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && procesos === null && <p className="text-sm text-gray-500">Cargando procesos…</p>}

      {!error && procesos !== null && procesos.length === 0 && (
        <EmptyState
          Icono={Gavel}
          titulo="Sin procesos registrados"
          descripcion="Todavía no se ha registrado ningún proceso judicial para esta usuaria."
          accion={<Button onClick={() => setDrawerAbierto(true)}>Registrar proceso</Button>}
        />
      )}

      {!error && procesos !== null && procesos.length > 0 && (
        <div className="space-y-3">
          {procesos.map((proceso) => (
            <TarjetaProceso key={proceso.id} procesoInicial={proceso} abogadas={abogadas} procuradoras={procuradoras} />
          ))}
        </div>
      )}

      <Drawer abierto={drawerAbierto} titulo="Nuevo proceso" onCerrar={() => setDrawerAbierto(false)}>
        <FormularioNuevoProceso
          expedienteId={expedienteId}
          abogadas={abogadas}
          procuradoras={procuradoras}
          onCreado={onProcesoCreado}
          onCancelar={() => setDrawerAbierto(false)}
        />
      </Drawer>
    </div>
  )
}
