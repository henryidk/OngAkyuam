import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  hoyGT,
  type CasoPorAgendarDto,
  type PersonaParaAbrirDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { atenderAhora, obtenerCasoPorAgendar } from '../api/psicologia.api'
import { etiquetaPersona } from '../compartido/personas'
import FormularioRegistro, { type ContextoRegistro } from './registro/FormularioRegistro'
import { VOLVER_A, migasDelRegistro, origenDeParametro, rutaDeOrigen } from './registro/origen'

function contextoAtenderAhora(caso: CasoPorAgendarDto, persona: PersonaParaAbrirDto): ContextoRegistro {
  return {
    procesoId: null,
    codigoProceso: persona.numero,
    // El proceso nace en Inicio: esta primera sesión atendida lo pasa a Seguimiento.
    procesoEtapa: 'INICIO',
    persona: persona.nombreCompleto,
    usuariaNombreCompleto: caso.usuariaNombreCompleto,
    esHijo: persona.ninoId !== null,
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
    crearSesion: (datos, clave) => atenderAhora(caso.referidoId, { ninoId: persona.ninoId, ...datos }, clave),
  }
}

/**
 * "Atender ahora" un caso tomado que no tiene primera cita: la persona está aquí y se atiende sin
 * agendar antes. Al registrar la sesión se abre su proceso, con esta como primera atención; si se
 * sale sin registrar no se crea nada y el caso sigue por agendar. Se atiende a una persona por vez:
 * las demás del caso se abren después, desde su ficha.
 */
export default function AtenderAhora() {
  const { referidoId } = useParams<{ referidoId: string }>()
  const [params] = useSearchParams()
  const origen = origenDeParametro(params.get('origen'))
  const [elegidaId, setElegidaId] = useState<string | null>(null)

  const cargar = useCallback(() => obtenerCasoPorAgendar(referidoId!), [referidoId])
  const { datos: caso, error, recargar } = useRecurso(cargar)

  useTituloPagina({ titulo: 'Atender ahora', migas: migasDelRegistro(origen, null, hoyGT()) })

  const rutaVolver = rutaDeOrigen(origen, null, hoyGT())

  if (error && !caso) {
    if (error.sinPermiso) {
      return <ErrorVista mensaje={error.mensaje} sinPermiso recurso="este caso" onReintentar={() => void recargar()} />
    }
    return (
      <Aviso titulo="No se puede atender este caso aquí" texto={error.mensaje}>
        <Link to={rutaVolver} className="inline-block text-sm font-medium text-brand-700 hover:underline">
          {VOLVER_A[origen]}
        </Link>
      </Aviso>
    )
  }
  if (!caso) return <Esqueleto />

  // Quien ya tiene un proceso abierto con otra psicóloga no se puede atender desde aquí.
  const libres = caso.personas.filter((persona) => persona.atendidaPor === null)
  const elegida = libres.length === 1 ? libres[0] : libres.find((persona) => (persona.ninoId ?? 'usuaria') === elegidaId)

  if (libres.length === 0) {
    return (
      <Aviso
        titulo="Nadie de este caso se puede atender ahora"
        texto="Cada persona ya tiene un proceso abierto con otra psicóloga."
      >
        <Link to={rutaVolver} className="inline-block text-sm font-medium text-brand-700 hover:underline">
          {VOLVER_A[origen]}
        </Link>
      </Aviso>
    )
  }

  if (!elegida) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h2 className="text-[22px] font-semibold tracking-tight text-gray-900">¿A quién atiendes ahora?</h2>
          <p className="mt-1 text-sm text-gray-600">
            Exp. {caso.expedienteNumero} · {caso.usuariaNombreCompleto}. Se registra la sesión de una persona; a las
            demás se les abre su proceso después.
          </p>
        </header>
        <ul className="space-y-2">
          {libres.map((persona) => (
            <li key={persona.ninoId ?? 'usuaria'}>
              <button
                type="button"
                onClick={() => setElegidaId(persona.ninoId ?? 'usuaria')}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">
                    {persona.ninoId === null ? persona.nombreCompleto : etiquetaPersona(persona)}
                  </span>
                  <span className="block text-xs text-gray-500 tabular-nums">
                    {persona.ninoId === null ? 'La usuaria' : 'Hija/o'} · {persona.numero}
                  </span>
                </span>
                <span aria-hidden="true" className="text-gray-400">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Link to={rutaVolver} className="inline-block text-sm font-medium text-gray-600 hover:underline">
          {VOLVER_A[origen]}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        El caso ya es tuyo. Si sales sin registrar la sesión, no se abre el proceso y el caso queda en la Agenda, por
        agendar.
      </p>
      <FormularioRegistro
        key={elegida.ninoId ?? 'usuaria'}
        contexto={contextoAtenderAhora(caso, elegida)}
        origen={origen}
      />
    </div>
  )
}

function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      <p className="text-sm text-gray-600">{texto}</p>
      {children}
    </div>
  )
}
