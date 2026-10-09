import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { fechaDeInstante } from '../../../lib/formato'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerPreviaToma } from '../api/psicologia.api'
import { etiquetaPersona } from '../compartido/personas'
import { RUTAS_PSICOLOGIA } from '../rutas'

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-gray-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-gray-800">{children}</dd>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">{titulo}</h3>
      {children}
    </section>
  )
}

interface VistaPreviaExpedienteProps {
  referidoId: string
  usuariaId: string
}

/** Resumen de un expediente referido, para decidir rápido desde la bandeja. El detalle está en la ficha. */
export default function VistaPreviaExpediente({ referidoId, usuariaId }: VistaPreviaExpedienteProps) {
  const cargar = useCallback(() => obtenerPreviaToma(referidoId), [referidoId])
  const { datos: previa, error, recargar } = useRecurso(cargar)

  if (error) {
    return (
      <ErrorVista
        mensaje={error.mensaje}
        sinPermiso={error.sinPermiso}
        recurso="este expediente"
        onReintentar={() => void recargar()}
      />
    )
  }
  if (!previa) return <Esqueleto />

  return (
    <div className="space-y-4">
      <Seccion titulo="Usuaria">
        <dl className="divide-y divide-gray-100">
          <Fila etiqueta="Nombre">{previa.usuariaNombreCompleto}</Fila>
          <Fila etiqueta="Edad">{previa.edad} años</Fila>
          <Fila etiqueta="Municipio">{previa.municipio ?? '—'}</Fila>
          <Fila etiqueta="Grupo étnico">{previa.grupoEtnico}</Fila>
        </dl>
      </Seccion>

      <Seccion titulo="Referencia">
        <dl className="divide-y divide-gray-100">
          <Fila etiqueta="Referida">
            {fechaDeInstante(previa.referidoEn)} · {previa.referidoPor}
          </Fila>
          <Fila etiqueta="Tipología (Decreto 22-2008)">
            {previa.tipologias === null
              ? 'No compartida por Trabajo Social'
              : previa.tipologias.join(', ') || '—'}
          </Fila>
        </dl>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Motivo de referencia</p>
        <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{previa.motivo || 'Sin motivo registrado.'}</p>
      </Seccion>

      <Seccion titulo="Personas a atender">
        <ul className="mt-1 space-y-1 text-sm text-gray-800">
          {previa.personas.map((persona) => (
            <li key={persona.ninoId ?? 'usuaria'}>{etiquetaPersona(persona)}</li>
          ))}
        </ul>
      </Seccion>

      <p className="text-xs text-gray-500">
        Este es un resumen. El expediente completo, con lo que Trabajo Social compartió con Psicología, está en la{' '}
        <Link to={RUTAS_PSICOLOGIA.usuaria(usuariaId)} className="font-medium text-brand-700 hover:underline">
          ficha de la usuaria
        </Link>
        .
      </p>
    </div>
  )
}
