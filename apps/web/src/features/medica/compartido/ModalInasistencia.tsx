import { useState } from 'react'
import { RotateCw, X } from 'lucide-react'
import { hoyGT, type PersonaAtendidaDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { extraerMensajeError } from '../../../lib/errors'
import { registrarInasistencia, reprogramarCita } from '../api/medica.api'
import { fechaLarga, fechaLargaEnFrase, horaMasMinutos } from './fechas'
import ModalMedica from './ModalMedica'
import { detallePersonasCita } from './personas'
import SelectorHorario from './SelectorHorario'
import { esConflictoHorario, MENSAJE_HORARIO_TOMADO, useHorario } from './useHorario'

/** Lo mínimo de una cita para registrar su inasistencia (viene de la agenda o de la ficha). */
export interface CitaInasistencia {
  id: string
  version: number
  fecha: string
  hora: string
  horaFin: string
  duracionMin: number
  /** Personas de la visita: la inasistencia y la nueva cita son de todas ellas. */
  personas: PersonaAtendidaDto[]
  usuariaNombreCompleto: string
  /** "Exp. 123-2026" o el código de la atención: identifica el caso en el subtítulo. */
  referencia: string
}

export interface ResultadoInasistencia {
  mensaje: string
  /** Día de la nueva cita, si se reprogramó (para "Ver en agenda"). */
  nuevaFecha: string | null
}

interface ModalInasistenciaProps {
  cita: CitaInasistencia
  /** `inasistencia`: la paciente no llegó. `reprogramar`: la inasistencia ya está registrada. */
  modo: 'inasistencia' | 'reprogramar'
  onCerrar: () => void
  onListo: (resultado: ResultadoInasistencia) => void
}

/**
 * Registra que la paciente no asistió y, si se puede, la reprograma en el mismo paso. Es de la
 * visita completa: si falta uno, faltan todos, y la nueva cita conserva las personas y la duración.
 */
export default function ModalInasistencia({ cita, modo, onCerrar, onListo }: ModalInasistenciaProps) {
  const [reprogramar, setReprogramar] = useState(true)
  // La nueva cita se propone desde mañana, a la misma hora si está libre.
  const horario = useHorario({ despuesDe: hoyGT(), hora: cita.hora, duracion: cita.duracionMin })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const soloReprogramar = modo === 'reprogramar'
  const conNuevaCita = soloReprogramar || reprogramar
  const titulo = soloReprogramar ? 'Reprogramar consulta' : 'No asistió a la consulta'
  const subtitulo = [
    cita.usuariaNombreCompleto,
    detallePersonasCita(cita.personas),
    cita.referencia,
  ]
    .filter(Boolean)
    .join(' · ')

  let etiquetaBoton = 'Registrar inasistencia'
  if (soloReprogramar) etiquetaBoton = 'Reprogramar'
  else if (reprogramar) etiquetaBoton = 'Registrar y reprogramar'

  async function guardar() {
    const inicio = horario.fecha && horario.hora ? `${horario.fecha}T${horario.hora}` : null
    if (conNuevaCita && !inicio) {
      setError('Elige el día y la hora de la nueva consulta.')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const textoNueva = `${fechaLargaEnFrase(horario.fecha!)}, ${horario.hora}`
      if (soloReprogramar) {
        await reprogramarCita(cita.id, { inicio: inicio!, version: cita.version })
        onListo({ mensaje: `Consulta reprogramada: ${textoNueva}`, nuevaFecha: horario.fecha })
      } else {
        const resultado = await registrarInasistencia(cita.id, {
          reprogramarA: reprogramar ? inicio : null,
          version: cita.version,
        })
        onListo(
          resultado.nuevaCita
            ? { mensaje: `Inasistencia registrada · nueva consulta: ${textoNueva}`, nuevaFecha: resultado.nuevaCita.fecha }
            : { mensaje: 'Inasistencia registrada', nuevaFecha: null },
        )
      }
    } catch (err) {
      if (esConflictoHorario(err)) {
        setError(MENSAJE_HORARIO_TOMADO)
        void horario.recargar()
      } else {
        setError(extraerMensajeError(err))
      }
    } finally {
      setGuardando(false)
    }
  }

  const opciones = [
    { valor: true, etiqueta: 'Reprogramar ahora' },
    { valor: false, etiqueta: 'Solo registrar inasistencia' },
  ]

  return (
    <ModalMedica
      titulo={titulo}
      subtitulo={subtitulo}
      ocupado={guardando}
      onCerrar={onCerrar}
      pie={
        <>
          <Button variante="secondary" tamano="md" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            tamano="md"
            onClick={() => void guardar()}
            disabled={conNuevaCita && (!horario.fecha || !horario.hora)}
            cargando={guardando}
          >
            {etiquetaBoton}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg border border-[#e3e6ea] bg-[#f8f9fa] px-3.5 py-2.5">
        <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#f0f2f4] text-[#4b5563]">
          <X className="h-3.5 w-3.5" />
        </span>
        <div className="text-[13px]">
          <p className="text-[#5b6573]">Consulta a la que no asistió</p>
          <p className="font-medium text-[#1c2430] line-through decoration-[#9aa4b0]">
            {fechaLarga(cita.fecha)} · {cita.hora} – {cita.horaFin}
          </p>
        </div>
      </div>

      {!soloReprogramar && (
        <div role="radiogroup" aria-label="Qué hacer" className="grid grid-cols-2 gap-1 rounded-lg bg-[#f0f2f4] p-1">
          {opciones.map((opcion) => (
            <button
              key={String(opcion.valor)}
              type="button"
              role="radio"
              aria-checked={reprogramar === opcion.valor}
              onClick={() => {
                setReprogramar(opcion.valor)
                setError(null)
              }}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                reprogramar === opcion.valor ? 'bg-white text-[#1c2430] shadow-sm' : 'text-[#5b6573] hover:text-[#1c2430]'
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}

      {conNuevaCita ? (
        <>
          {horario.error ? (
            <ErrorVista mensaje={horario.error.mensaje} onReintentar={() => void horario.recargar()} />
          ) : !horario.disponibilidad ? (
            <Esqueleto filas={1} />
          ) : (
            <SelectorHorario
              etiquetaDia="Nuevo día"
              disponibilidad={horario.disponibilidad}
              fecha={horario.fecha}
              hora={horario.hora}
              onFecha={(fecha) => {
                horario.elegirFecha(fecha)
                setError(null)
              }}
              onHora={(hora) => {
                horario.elegirHora(hora)
                setError(null)
              }}
            />
          )}
          <div className="flex items-center gap-3 rounded-lg border border-[#e6dbf3] bg-[#f7f3fc] px-3.5 py-3">
            <span
              aria-hidden="true"
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#7346a5] text-white"
            >
              <RotateCw className="h-4 w-4" />
            </span>
            <div className="text-[13px]">
              <p className="font-semibold text-[#5b3985]">Nueva consulta</p>
              <p className="text-[#1c2430]">
                {horario.fecha && horario.hora
                  ? `${fechaLarga(horario.fecha)} · ${horario.hora} – ${horaMasMinutos(horario.hora, cita.duracionMin)}`
                  : 'Elige una hora'}
              </p>
              {cita.personas.length > 1 && (
                <p className="text-[12px] text-[#5b6573]">Con las mismas {cita.personas.length} personas de la visita</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-[#f8f9fa] px-3.5 py-2.5 text-[13px] text-[#5b6573]">
          Se registra la inasistencia sin nueva cita. La paciente aparecerá en{' '}
          <strong className="font-semibold text-[#1c2430]">Sin próxima consulta</strong> para que la programes cuando la contactes.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#9b2c20]">
          {error}
        </p>
      )}
    </ModalMedica>
  )
}
