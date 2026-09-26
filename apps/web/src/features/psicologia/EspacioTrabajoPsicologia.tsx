import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import {
  ESTADOS_ATENCION_PSICOLOGICA,
  ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA,
  formatInstanteGT,
  type AtencionPsicologicaDetalle,
  type EstadoAtencionPsicologica,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import ContenidoDetalleExpediente from '../area-atencion/ContenidoDetalleExpediente'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import EmptyState from '../../components/ui/EmptyState'
import FormularioNuevaCita from './FormularioNuevaCita'
import TarjetaCita from './TarjetaCita'

interface EspacioTrabajoPsicologiaProps {
  expedienteId: string
}

export default function EspacioTrabajoPsicologia({ expedienteId }: EspacioTrabajoPsicologiaProps) {
  const [atencion, setAtencion] = useState<AtencionPsicologicaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawerAbierto, setDrawerAbierto] = useState(false)

  const cargarAtencion = useCallback(async () => {
    try {
      const { data } = await api.get<AtencionPsicologicaDetalle>(
        `/psicologia/expedientes/${expedienteId}/atencion`,
      )
      setAtencion(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    void cargarAtencion()
  }, [cargarAtencion])

  function onCitaCreada() {
    setDrawerAbierto(false)
    void cargarAtencion()
  }

  return (
    <div className="space-y-4">
      <Link to="/psicologia" className="text-sm font-medium text-brand-600 hover:underline">
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

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && atencion === null && <p className="text-sm text-gray-500">Cargando atención…</p>}

      {!error && atencion !== null && (
        <>
          <SeccionEstadoAtencion
            expedienteId={expedienteId}
            atencion={atencion}
            onActualizado={(patch) => setAtencion((actual) => actual && { ...actual, ...patch })}
          />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Citas</h2>
            <Button onClick={() => setDrawerAbierto(true)}>Programar cita</Button>
          </div>

          {atencion.citas.length === 0 ? (
            <EmptyState
              Icono={CalendarClock}
              titulo="Sin citas registradas"
              descripcion="Todavía no se ha programado ninguna cita para esta usuaria."
              accion={<Button onClick={() => setDrawerAbierto(true)}>Programar cita</Button>}
            />
          ) : (
            <div className="space-y-3">
              {atencion.citas.map((cita) => (
                <TarjetaCita key={cita.id} citaInicial={cita} />
              ))}
            </div>
          )}
        </>
      )}

      <Drawer abierto={drawerAbierto} titulo="Programar cita" onCerrar={() => setDrawerAbierto(false)}>
        <FormularioNuevaCita
          expedienteId={expedienteId}
          onCreada={onCitaCreada}
          onCancelar={() => setDrawerAbierto(false)}
        />
      </Drawer>
    </div>
  )
}

// ---- Estado de atención (Inicio / En seguimiento / Cierre) ----

interface SeccionEstadoAtencionProps {
  expedienteId: string
  atencion: AtencionPsicologicaDetalle
  onActualizado: (patch: Partial<AtencionPsicologicaDetalle>) => void
}

function SeccionEstadoAtencion({ expedienteId, atencion, onActualizado }: SeccionEstadoAtencionProps) {
  const [estado, setEstado] = useState(atencion.estado)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const { data } = await api.patch<AtencionPsicologicaDetalle>(
        `/psicologia/expedientes/${expedienteId}/atencion`,
        { estado },
      )
      onActualizado({
        estado: data.estado,
        actualizadoPor: data.actualizadoPor,
        actualizadoEn: data.actualizadoEn,
      })
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-gray-800">Estado de atención</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Estado</span>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value as EstadoAtencionPsicologica)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {ESTADOS_ATENCION_PSICOLOGICA.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[valor]}
              </option>
            ))}
          </select>
        </label>
        <Button variante="secondary" onClick={guardar} cargando={guardando} disabled={estado === atencion.estado}>
          Guardar estado
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Última actualización: {atencion.actualizadoPor} · {formatInstanteGT(atencion.actualizadoEn)}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
