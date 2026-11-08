import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  formatInstanteGT,
  hoyGT,
  type ProcesoPsicologiaDetalle,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerProceso } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'
import FormularioRegistro, { type ContextoRegistro } from './registro/FormularioRegistro'
import { migasDelRegistro, origenDeParametro } from './registro/origen'

function contextoSinCita(proceso: ProcesoPsicologiaDetalle): ContextoRegistro {
  return {
    procesoId: proceso.id,
    codigoProceso: proceso.codigo,
    procesoEtapa: proceso.etapa,
    persona: proceso.persona.nombreCompleto,
    usuariaNombreCompleto: proceso.usuariaNombreCompleto,
    esHijo: proceso.persona.ninoId !== null,
    cita: null,
    yaRegistrada: false,
    valores: {
      estado: 'ATENDIDA',
      temas: '',
      intervencion: '',
      atencionBrindada: '',
      diagnostico: '',
      acuerdos: '',
      observaciones: '',
      motivoNoAsistencia: '',
      clinica: null,
      enfoqueTerapeutico: '',
    },
    documento: null,
    duracion: DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  }
}

/**
 * Sesión que se atiende sin cita previa: la cita nace al registrarla, con la fecha y hora del
 * servidor, y queda en las citas de la persona. Si se sale sin registrar, no queda nada.
 */
export default function RegistroSesionSinCita() {
  const { procesoId } = useParams<{ procesoId: string }>()
  const [params] = useSearchParams()
  const origen = origenDeParametro(params.get('origen'))

  const cargar = useCallback(() => obtenerProceso(procesoId!), [procesoId])
  const { datos: proceso, error, recargar } = useRecurso(cargar)

  useTituloPagina({
    titulo: 'Sesión sin cita',
    migas: migasDelRegistro(origen, proceso ? { id: proceso.id, codigo: proceso.codigo } : null, hoyGT()),
  })

  if (error && !proceso) {
    return (
      <ErrorVista
        mensaje={error.mensaje}
        sinPermiso={error.sinPermiso}
        recurso="este proceso"
        onReintentar={() => void recargar()}
      />
    )
  }
  if (!proceso) return <Esqueleto />

  if (!proceso.accionesDisponibles.includes('REGISTRAR_SESION')) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">No se puede registrar una sesión en este proceso</h2>
        <p className="text-sm text-gray-600">
          {proceso.etapa === 'CIERRE'
            ? 'El proceso está cerrado. Si la usuaria necesita volver, se le abre un proceso nuevo desde su ficha.'
            : 'Este proceso lo lleva otra psicóloga: se puede leer, pero no registrar sesiones.'}
        </p>
        <Link
          to={RUTAS_PSICOLOGIA.proceso(proceso.id)}
          className="inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          Ir al proceso {proceso.codigo} →
        </Link>
      </div>
    )
  }

  const agendada = proceso.proximaCita
  return (
    <div className="space-y-4">
      {/* Si vino por la cita que ya tenía agendada, se registra esa misma cita, no una aparte. */}
      {agendada && (
        <p className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {proceso.persona.nombreCompleto} tiene una cita agendada el {formatInstanteGT(agendada.fechaHora)}. Si vino
          por esa cita,{' '}
          <Link
            to={RUTAS_PSICOLOGIA.registrarConsulta(agendada.id, origen)}
            className="font-medium text-brand-700 underline"
          >
            registra esa cita
          </Link>
          ; aquí se registra una sesión adicional.
        </p>
      )}
      <FormularioRegistro key={proceso.id} contexto={contextoSinCita(proceso)} origen={origen} />
    </div>
  )
}
