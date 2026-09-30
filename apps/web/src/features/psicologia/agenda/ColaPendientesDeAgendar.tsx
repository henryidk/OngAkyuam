import { Link } from 'react-router-dom'
import { formatInstanteGT, type ProcesoSinProximaCita, type TipoCitaPsicologica } from '@akyuam/shared'
import { RUTAS_PSICOLOGIA } from '../rutas'
import TarjetaCola from './TarjetaCola'

interface ColaPendientesDeAgendarProps {
  procesos: ProcesoSinProximaCita[]
  /** Día abierto en el calendario — precarga la fecha del formulario. */
  fecha: string
}

/**
 * Un proceso sin ninguna cita registrada nunca ha sido atendido: lo que le toca es una primera
 * atención, no un seguimiento. Confundir ambos casos es lo que hacía que un caso recién tomado
 * ofreciera "Agendar seguimiento" (§5.1 del plan).
 */
function esPrimeraCita(proceso: ProcesoSinProximaCita) {
  return proceso.ultimaCitaFechaHora === null
}

interface GrupoProps {
  titulo: string
  descripcion: string
  procesos: ProcesoSinProximaCita[]
  tipo: TipoCitaPsicologica
  etiquetaAccion: string
  fecha: string
}

function GrupoPendientes({ titulo, descripcion, procesos, tipo, etiquetaAccion, fecha }: GrupoProps) {
  if (procesos.length === 0) return null

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</h3>
        <p className="text-xs text-gray-400">{descripcion}</p>
      </div>
      {procesos.map((proceso) => (
        <TarjetaCola
          key={proceso.expedienteId}
          nombre={proceso.usuariaNombreCompleto}
          numero={proceso.numero}
          detalle={
            proceso.ultimaCitaFechaHora
              ? `Última cita: ${formatInstanteGT(proceso.ultimaCitaFechaHora)}`
              : 'Sin citas registradas'
          }
        >
          <Link
            to={RUTAS_PSICOLOGIA.nuevaCita({ expedienteId: proceso.expedienteId, tipo, fecha })}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            {etiquetaAccion}
          </Link>
        </TarjetaCola>
      ))}
    </div>
  )
}

export default function ColaPendientesDeAgendar({ procesos, fecha }: ColaPendientesDeAgendarProps) {
  const sinPrimeraCita = procesos.filter(esPrimeraCita)
  const sinSeguimiento = procesos.filter((proceso) => !esPrimeraCita(proceso))

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Pendientes de agendar</h2>
        <p className="text-xs text-gray-500">Mis procesos activos sin próxima cita.</p>
      </div>

      {procesos.length === 0 ? (
        <p className="text-sm text-gray-400">Todos mis procesos activos tienen próxima cita.</p>
      ) : (
        <>
          <GrupoPendientes
            titulo="Sin primera cita"
            descripcion="Casos tomados que aún no han sido atendidos."
            procesos={sinPrimeraCita}
            tipo="PRIMERA_ATENCION"
            etiquetaAccion="Agendar primera cita"
            fecha={fecha}
          />
          <GrupoPendientes
            titulo="Seguimiento sin próxima cita"
            descripcion="Procesos en curso que se quedaron sin siguiente fecha."
            procesos={sinSeguimiento}
            tipo="SEGUIMIENTO"
            etiquetaAccion="Agendar seguimiento"
            fecha={fecha}
          />
        </>
      )}
    </section>
  )
}
