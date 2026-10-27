import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ETIQUETAS_PUESTO,
  formatFechaGT,
  formatInstanteCortoGT,
  type HijoFichaPsicologiaDto,
  type ProcesoAbiertoPersonaDto,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { fechaDeInstante } from '../../../lib/formato'
import EtiquetaEtapa from '../compartido/EtiquetaEtapa'
import { RUTAS_PSICOLOGIA } from '../rutas'
import type { PersonaPorAbrir } from './contextoFicha'

interface TarjetaHijosProps {
  hijos: HijoFichaPsicologiaDto[]
  onAbrirProceso: (porAbrir: PersonaPorAbrir) => void
  /** Proceso recién abierto: si es de un hijo/a, su "Ver proceso" toma el foco. */
  procesoRecienAbierto: string | null
}

/** Sufijo del número del hijo/a en el expediente: "04-2026.01" → ".01". */
function sufijoNumero(numero: string): string {
  const punto = numero.lastIndexOf('.')
  return punto === -1 ? numero : numero.slice(punto)
}

function textoResponsable(responsable: ProcesoAbiertoPersonaDto['responsable']): string | null {
  if (!responsable) return null
  const puesto = responsable.puesto ? ETIQUETAS_PUESTO[responsable.puesto] : undefined
  return `Atiende ${responsable.nombreCompleto}${puesto ? ` · ${puesto}` : ''}`
}

function ProcesoDelHijo({ proceso, enfocar }: { proceso: ProcesoAbiertoPersonaDto; enfocar: boolean }) {
  const enlace = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (enfocar) enlace.current?.focus()
  }, [enfocar])
  const responsable = textoResponsable(proceso.responsable)

  return (
    <div className="space-y-0.5 sm:text-right">
      <EtiquetaEtapa etapa={proceso.etapa} />
      {responsable && <p className="text-xs text-gray-600">{responsable}</p>}
      <p className="text-xs tabular-nums text-gray-500">
        {proceso.proximaCita ? `Próxima: ${formatInstanteCortoGT(proceso.proximaCita)}` : 'Sin próxima cita'}
      </p>
      <Link
        ref={enlace}
        to={RUTAS_PSICOLOGIA.proceso(proceso.procesoId)}
        className="inline-block text-xs font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        Ver proceso →
      </Link>
    </div>
  )
}

/**
 * "Hijas e hijos" del expediente en la ficha de la madre: cada uno con su número, su atención en
 * Psicología (cada persona lleva su propio proceso) y, si no tiene uno abierto, cómo abrirlo.
 */
export default function TarjetaHijos({ hijos, onAbrirProceso, procesoRecienAbierto }: TarjetaHijosProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white" aria-labelledby="titulo-hijos">
      <div className="border-b border-gray-100 px-5 py-3">
        <h3 id="titulo-hijos" className="text-sm font-semibold text-gray-900">
          Hijas e hijos · <span className="tabular-nums">{hijos.length}</span>
        </h3>
      </div>
      {hijos.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">
          No hay hijas ni hijos registrados en este expediente. Trabajo Social los registra.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {hijos.map((hijo) => (
            <li
              key={hijo.ninoId}
              className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span title={hijo.numero} className="font-mono text-[13px] font-medium tabular-nums text-gray-500">
                    {sufijoNumero(hijo.numero)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{hijo.nombreCompleto}</span>
                </p>
                <p className="text-xs tabular-nums text-gray-500">
                  {hijo.edad} años · {hijo.genero === 'M' ? 'Niña' : 'Niño'} · {formatFechaGT(hijo.fechaNacimiento)}
                </p>
              </div>
              {hijo.procesoAbierto ? (
                <ProcesoDelHijo
                  proceso={hijo.procesoAbierto}
                  enfocar={hijo.procesoAbierto.procesoId === procesoRecienAbierto}
                />
              ) : (
                <div className="space-y-1 sm:text-right">
                  <p className="text-xs font-medium text-gray-600">Sin proceso activo</p>
                  {hijo.ultimoCierre && (
                    <p className="text-xs tabular-nums text-gray-500">
                      Último cerrado: {fechaDeInstante(hijo.ultimoCierre)}
                    </p>
                  )}
                  {hijo.puedeAbrirProceso && (
                    <Button
                      variante="secondary"
                      tamano="sm"
                      onClick={() =>
                        onAbrirProceso({
                          persona: {
                            ninoId: hijo.ninoId,
                            nombreCompleto: hijo.nombreCompleto,
                            edad: hijo.edad,
                          },
                          codigo: hijo.codigoProcesoNuevo,
                        })
                      }
                    >
                      Abrir proceso
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
