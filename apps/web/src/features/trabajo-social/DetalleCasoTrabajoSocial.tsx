import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_GENERO,
  ETIQUETAS_TIPO_REGISTRO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  formatFechaGT,
  type ExpedienteDetalleCaso,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import PestanaDocumentos from './ficha/pestanas/PestanaDocumentos'

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
 * Los documentos se montan aquí con la pestaña de la ficha hasta que exista la ficha con rutas.
 */
export default function DetalleCasoTrabajoSocial({ expedienteId, onVolver }: DetalleCasoTrabajoSocialProps) {
  const [expediente, setExpediente] = useState<ExpedienteDetalleCaso | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api
      .get<ExpedienteDetalleCaso>(`/trabajo-social/expedientes/${expedienteId}`)
      .then(({ data }) => {
        if (!cancelado) setExpediente(data)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button type="button" onClick={onVolver} className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Volver al expediente
      </button>

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
        </div>
      )}
    </div>
  )
}
