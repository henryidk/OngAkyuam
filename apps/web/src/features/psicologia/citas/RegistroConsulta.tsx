import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  RESULTADOS_SESION_PSICOLOGICA,
  fechaCalendarioGT,
  type CitaPsicologicaDetalle,
  type ResultadoSesionPsicologica,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerDetalleCita } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'
import FormularioRegistro, { type ContextoRegistro } from './registro/FormularioRegistro'
import { migasDelRegistro, origenDeParametro } from './registro/origen'

function esResultado(estado: string): estado is ResultadoSesionPsicologica {
  return (RESULTADOS_SESION_PSICOLOGICA as readonly string[]).includes(estado)
}

function contextoDeCita(cita: CitaPsicologicaDetalle): ContextoRegistro {
  return {
    procesoId: cita.procesoId,
    codigoProceso: cita.codigoProceso,
    procesoEtapa: cita.procesoEtapa,
    persona: cita.ninoNombreCompleto ?? cita.usuariaNombreCompleto,
    usuariaNombreCompleto: cita.usuariaNombreCompleto,
    esHijo: cita.ninoNombreCompleto !== null,
    cita: { id: cita.id, fechaHora: cita.fechaHora, duracionMinutos: cita.duracionMinutos },
    // Una sesión ya registrada se puede corregir, pero "¿Qué sigue?" se decidió en su momento.
    yaRegistrada: esResultado(cita.estado),
    // Lo que ya estaba guardado (una sesión que se corrige) entra al formulario.
    valores: {
      estado: esResultado(cita.estado) ? cita.estado : 'ATENDIDA',
      temas: cita.temas ?? '',
      intervencion: cita.intervencion ?? '',
      atencionBrindada: cita.atencionBrindada ?? '',
      diagnostico: cita.diagnostico ?? '',
      acuerdos: cita.acuerdos ?? '',
      observaciones: cita.observaciones ?? '',
      motivoNoAsistencia: cita.motivoNoAsistencia ?? '',
      // La del servidor: la ya anotada o la última que usó esta profesional.
      clinica: cita.clinicaSugerida,
      enfoqueTerapeutico: cita.enfoqueTerapeutico ?? '',
    },
    documento: cita.documento,
    duracion:
      DURACIONES_CITA_PSICOLOGICA_MINUTOS.find((minutos) => minutos === cita.duracionMinutos) ??
      DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  }
}

/**
 * Registrar la sesión de una cita existente. `?origen=` (agenda | consultas) regresa a esa
 * pantalla al guardar, para seguir con la siguiente persona sin buscarla otra vez; sin él se
 * vuelve al proceso.
 */
export default function RegistroConsulta() {
  const { citaId } = useParams<{ citaId: string }>()
  const [params] = useSearchParams()
  const origen = origenDeParametro(params.get('origen'))

  const cargar = useCallback(() => obtenerDetalleCita(citaId!), [citaId])
  const { datos: cita, error, recargar } = useRecurso(cargar)

  useTituloPagina({
    titulo: 'Registrar sesión',
    migas: migasDelRegistro(
      origen,
      cita ? { id: cita.procesoId, codigo: cita.codigoProceso } : null,
      cita ? fechaCalendarioGT(new Date(cita.fechaHora)) : undefined,
    ),
  })

  if (error && !cita) {
    return (
      <ErrorVista
        mensaje={error.mensaje}
        sinPermiso={error.sinPermiso}
        recurso="esta cita"
        onReintentar={() => void recargar()}
      />
    )
  }
  if (!cita) return <Esqueleto />

  if (cita.procesoEtapa === 'CIERRE' || cita.estado === 'REPROGRAMADA') {
    return (
      <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Esta sesión ya no se puede registrar</h2>
        <p className="text-sm text-gray-600">
          {cita.procesoEtapa === 'CIERRE'
            ? 'El proceso está cerrado. Si la usuaria necesita volver, se le abre un proceso nuevo desde su ficha.'
            : 'La cita se movió a otra fecha: registra la sesión desde la cita nueva.'}
        </p>
        <Link
          to={RUTAS_PSICOLOGIA.proceso(cita.procesoId)}
          className="inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          Ir al proceso {cita.codigoProceso} →
        </Link>
      </div>
    )
  }

  return <FormularioRegistro key={cita.id} contexto={contextoDeCita(cita)} origen={origen} />
}
