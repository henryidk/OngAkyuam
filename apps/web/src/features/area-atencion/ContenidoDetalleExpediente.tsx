import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  ETIQUETAS_GENERO,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_TIPO_DOCUMENTO,
  ETIQUETAS_TIPO_REGISTRO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  formatFechaGT,
  type ExpedienteDetalleArea as ExpedienteDetalleAreaDto,
} from '@akyuam/shared'
import { Download, FileText, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import EmptyState from '../../components/ui/EmptyState'

interface ContenidoDetalleExpedienteProps {
  expedienteId: string
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

function formatearTamanio(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Contenido puro del detalle de un expediente visto desde un área — sin `useParams`, para
 * poder reusarse tanto en la página completa (`DetalleExpedienteArea`) como dentro del
 * drawer de jurídico (`DrawerDetalleExpediente`), ver planjuridico.md punto 11.
 */
export default function ContenidoDetalleExpediente({ expedienteId }: ContenidoDetalleExpedienteProps) {
  const [expediente, setExpediente] = useState<ExpedienteDetalleAreaDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [descargandoId, setDescargandoId] = useState<string | null>(null)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api
      .get<ExpedienteDetalleAreaDto>(`/areas/expedientes/${expedienteId}`)
      .then(({ data }) => {
        if (!cancelado) setExpediente(data)
      })
      .catch((err) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId])

  async function descargar(documentoId: string) {
    setErrorDescarga(null)
    setDescargandoId(documentoId)
    try {
      const { data } = await api.get<{ url: string }>(
        `/areas/expedientes/${expedienteId}/documentos/${documentoId}/url`,
      )
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setErrorDescarga(extraerMensajeError(err))
    } finally {
      setDescargandoId(null)
    }
  }

  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (!expediente) {
    return <p className="text-sm text-gray-500">Cargando expediente…</p>
  }

  return (
    <div className="space-y-4">
      <Seccion titulo="Datos del caso">
        <Fila etiqueta="Número" valor={expediente.numero} />
        <Fila etiqueta="Fecha" valor={formatFechaGT(expediente.fecha)} />
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
          etiqueta="Municipio"
          valor={
            expediente.municipio
              ? ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[
                  expediente.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ
                ]
              : (expediente.usuaria.municipioOtro ?? '')
          }
        />
        {expediente.usuaria.departamentoOtro && (
          <Fila etiqueta="Departamento de origen" valor={expediente.usuaria.departamentoOtro} />
        )}
        <Fila etiqueta="Ubicación geográfica" valor={expediente.usuaria.ubicacionGeografica ?? ''} />
        <Fila
          etiqueta="Grupo étnico"
          valor={ETIQUETAS_GRUPO_ETNICO[expediente.usuaria.grupoEtnico as keyof typeof ETIQUETAS_GRUPO_ETNICO]}
        />
      </Seccion>

      {expediente.datosCaso ? (
        <>
          <Seccion titulo="Situación de violencia">
            <Fila
              etiqueta="Tipología del delito"
              valor={expediente.datosCaso.tipologiaDelito
                .map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo as keyof typeof ETIQUETAS_TIPOLOGIA_DELITO])
                .join(', ')}
            />
            <Fila etiqueta="Observaciones" valor={expediente.datosCaso.observaciones ?? ''} />
          </Seccion>

          <Seccion titulo="Datos del agresor">
            {expediente.datosCaso.agresor ? (
              <>
                <Fila etiqueta="Nombres" valor={expediente.datosCaso.agresor.nombres ?? ''} />
                <Fila etiqueta="Apellidos" valor={expediente.datosCaso.agresor.apellidos ?? ''} />
                <Fila etiqueta="Teléfono" valor={expediente.datosCaso.agresor.telefono ?? ''} />
                <Fila etiqueta="Dirección" valor={expediente.datosCaso.agresor.direccion ?? ''} />
              </>
            ) : (
              <p className="py-1.5 text-sm text-gray-400">No se registraron datos del agresor.</p>
            )}
          </Seccion>
        </>
      ) : (
        <Seccion titulo="Situación de violencia">
          <p className="py-1.5 text-sm text-gray-400">
            Trabajo Social no compartió la tipología, el agresor ni las observaciones de este caso con tu área.
          </p>
        </Seccion>
      )}

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

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Documentos</h3>

        {errorDescarga && <p className="mb-2 text-xs text-red-600">{errorDescarga}</p>}

        {expediente.documentos.length === 0 ? (
          <EmptyState
            Icono={FileText}
            titulo="Sin documentos visibles"
            descripcion="Trabajo social no ha habilitado documentos para esta área todavía."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {expediente.documentos.map((documento) => (
              <li key={documento.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">{ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}</p>
                  <p className="truncate text-xs text-gray-500">
                    {documento.nombreArchivo} · {formatearTamanio(documento.tamanioBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => descargar(documento.id)}
                  disabled={descargandoId === documento.id}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  {descargandoId === documento.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Descargar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
