import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ETIQUETAS_GENERO,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_TIPO_REGISTRO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  formatFechaGT,
  type ExpedienteDetalleArea as ExpedienteDetalleAreaDto,
} from '@akyuam/shared'
import PanelLayout from '../../components/PanelLayout'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

interface DetalleExpedienteAreaProps {
  basePath: string
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

export default function DetalleExpedienteArea({ basePath }: DetalleExpedienteAreaProps) {
  const { id } = useParams<{ id: string }>()
  const [expediente, setExpediente] = useState<ExpedienteDetalleAreaDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    api
      .get<ExpedienteDetalleAreaDto>(`/areas/expedientes/${id}`)
      .then(({ data }) => {
        if (!cancelado) setExpediente(data)
      })
      .catch((err) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [id])

  return (
    <PanelLayout titulo="Detalle del expediente">
      <div className="mb-4">
        <Link to={basePath} className="text-sm font-medium text-brand-600 hover:underline">
          ← Volver al listado
        </Link>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!error && !expediente && <p className="text-sm text-gray-500">Cargando expediente…</p>}

      {!error && expediente && (
        <div className="space-y-4">
          <Seccion titulo="Datos del caso">
            <Fila etiqueta="Número" valor={expediente.numero} />
            <Fila etiqueta="Fecha" valor={formatFechaGT(expediente.fecha)} />
            <Fila
              etiqueta="Municipio"
              valor={
                expediente.municipio
                  ? ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[
                      expediente.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ
                    ]
                  : (expediente.municipioOtro ?? '')
              }
            />
            {expediente.departamentoOtro && <Fila etiqueta="Departamento de origen" valor={expediente.departamentoOtro} />}
            <Fila etiqueta="Ubicación geográfica" valor={expediente.ubicacionGeografica} />
            <Fila etiqueta="Tipo de registro" valor={ETIQUETAS_TIPO_REGISTRO[expediente.tipoRegistro]} />
          </Seccion>

          <Seccion titulo="Datos de la usuaria">
            <Fila etiqueta="Nombres" valor={expediente.usuaria.nombres} />
            <Fila etiqueta="Apellidos" valor={expediente.usuaria.apellidos} />
            <Fila etiqueta="DPI" valor={expediente.usuaria.dpi ?? ''} />
            <Fila etiqueta="Teléfono" valor={expediente.usuaria.telefono ?? ''} />
            <Fila etiqueta="Dirección" valor={expediente.usuaria.direccion ?? ''} />
            <Fila etiqueta="Fecha de nacimiento" valor={formatFechaGT(expediente.usuaria.fechaNacimiento)} />
            <Fila
              etiqueta="Grupo étnico"
              valor={ETIQUETAS_GRUPO_ETNICO[expediente.usuaria.grupoEtnico as keyof typeof ETIQUETAS_GRUPO_ETNICO]}
            />
            <Fila
              etiqueta="Tipología del delito"
              valor={expediente.usuaria.tipologiaDelito
                .map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo as keyof typeof ETIQUETAS_TIPOLOGIA_DELITO])
                .join(', ')}
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
        </div>
      )}
    </PanelLayout>
  )
}
