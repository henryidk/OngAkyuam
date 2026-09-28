import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_GENERO,
  ETIQUETAS_TIPO_REGISTRO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  formatFechaGT,
  type ExpedienteDetalleCaso,
  type ReferidoCreado,
} from '@akyuam/shared'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import { useMatrizAccesos } from './accesos/useMatrizAccesos'
import PestanaAccesos from './ficha/pestanas/PestanaAccesos'
import PestanaDocumentos from './ficha/pestanas/PestanaDocumentos'
import ModalReferir from './referir/ModalReferir'

interface DetalleCasoTrabajoSocialProps {
  expedienteId: string
  onVolver: () => void
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-gray-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-gray-800">{valor || '—'}</dd>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">{titulo}</h3>
      <dl className="divide-y divide-gray-100">{children}</dl>
    </section>
  )
}

/**
 * Detalle de un caso puntual visto desde Trabajo Social — a diferencia de
 * `ContenidoDetalleExpediente` (áreas de atención), no repite identidad de la usuaria (vive en
 * el hub) y no filtra documentos por visibilidad de área: Trabajo Social ve todo lo que subió.
 * Documentos, Accesos y el modal Referir se montan aquí hasta que exista la ficha con rutas.
 */
export default function DetalleCasoTrabajoSocial({ expedienteId, onVolver }: DetalleCasoTrabajoSocialProps) {
  const [expediente, setExpediente] = useState<ExpedienteDetalleCaso | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [referirAbierto, setReferirAbierto] = useState(false)
  // Sin Toast todavía (§12.10): la confirmación de "Referir" se muestra inline sobre el caso.
  const [avisoReferido, setAvisoReferido] = useState<string | null>(null)
  const accesos = useMatrizAccesos(expedienteId)
  const recargarAccesos = accesos.recargar

  const cargarExpediente = useCallback(async () => {
    try {
      const { data } = await api.get<ExpedienteDetalleCaso>(`/trabajo-social/expedientes/${expedienteId}`)
      setExpediente(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    setExpediente(null)
    setError(null)
    void cargarExpediente()
  }, [cargarExpediente])

  const onReferido = useCallback(
    (referido: ReferidoCreado) => {
      setReferirAbierto(false)
      setAvisoReferido(`Referida a ${ETIQUETAS_AREA_ATENCION[referido.area]} · ya aparece en su bandeja`)
      void cargarExpediente()
      void recargarAccesos()
    },
    [cargarExpediente, recargarAccesos],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onVolver} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Volver al expediente
        </button>
        {expediente && (
          <Button tamano="md" onClick={() => setReferirAbierto(true)}>
            Referir a un área
          </Button>
        )}
      </div>

      {avisoReferido && (
        <p role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {avisoReferido}
        </p>
      )}

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && !expediente && <p className="text-sm text-gray-500">Cargando caso…</p>}

      {expediente && (
        <div className="space-y-4">
          <Seccion titulo="Datos del caso">
            <Fila etiqueta="Número" valor={expediente.numero} />
            <Fila etiqueta="Fecha" valor={formatFechaGT(expediente.fecha)} />
            <Fila etiqueta="Tipo de registro" valor={ETIQUETAS_TIPO_REGISTRO[expediente.tipoRegistro]} />
            <Fila
              etiqueta="Tipología del delito"
              valor={expediente.tipologiaDelito
                .map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo as keyof typeof ETIQUETAS_TIPOLOGIA_DELITO])
                .join(', ')}
            />
            <Fila
              etiqueta="Áreas referidas"
              valor={expediente.areasReferidas.map((area) => ETIQUETAS_AREA_ATENCION[area]).join(', ')}
            />
          </Seccion>

          <Seccion titulo="Datos del agresor">
            {expediente.agresor ? (
              <>
                <Fila etiqueta="Nombres" valor={expediente.agresor.nombres ?? ''} />
                <Fila etiqueta="Apellidos" valor={expediente.agresor.apellidos ?? ''} />
                <Fila etiqueta="Teléfono" valor={expediente.agresor.telefono ?? ''} />
                <Fila etiqueta="Dirección" valor={expediente.agresor.direccion ?? ''} />
              </>
            ) : (
              <p className="py-1.5 text-sm text-gray-400">No se registraron datos del agresor.</p>
            )}
          </Seccion>

          {expediente.ninos.length > 0 && (
            <Seccion titulo="Niñas y niños">
              <div className="py-1.5">
                <ul className="space-y-1 text-sm">
                  {expediente.ninos.map((nino, indice) => (
                    <li key={indice} className="text-gray-700">
                      {nino.nombres} {nino.apellidos} — {ETIQUETAS_GENERO[nino.genero]}, nacimiento{' '}
                      {formatFechaGT(nino.fechaNacimiento)}
                    </li>
                  ))}
                </ul>
              </div>
            </Seccion>
          )}

          <PestanaDocumentos expedienteId={expedienteId} />

          <PestanaAccesos accesos={accesos} />
        </div>
      )}

      {expediente && referirAbierto && (
        <ModalReferir
          expedienteId={expedienteId}
          numeroExpediente={expediente.numero}
          areasReferidas={expediente.areasReferidas}
          onCerrar={() => setReferirAbierto(false)}
          onReferido={onReferido}
        />
      )}
    </div>
  )
}
