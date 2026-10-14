import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { CitaMedicaProgramadaDto, ProgramablesMedicaQuery, ProgramarCitaMedicaInput } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { extraerMensajeError } from '../../../lib/errors'
import { useRecurso } from '../../../lib/useRecurso'
import { listarProgramables, programarCita } from '../api/medica.api'
import { CLASE_CAMPO } from '../compartido/estilos'
import { fechaLarga } from '../compartido/fechas'
import ModalMedica from '../compartido/ModalMedica'
import SelectorHorario from './SelectorHorario'
import SelectorPersona from './SelectorPersona'
import { esConflictoHorario, MENSAJE_HORARIO_TOMADO, useHorario } from './useHorario'

interface ModalProgramarProps {
  /** Paciente ya elegida (desde una referencia o desde la ficha); vacío = se elige en el modal. */
  preseleccion: ProgramablesMedicaQuery
  onCerrar: () => void
  onProgramada: (cita: CitaMedicaProgramadaDto) => void
}

/**
 * Programar una consulta. Si la paciente no tiene atención activa (primera consulta o regresa
 * tras un alta), al guardar se abre la atención. Solo se ofrecen horas libres del horario de la
 * médica; si otra persona toma la misma hora entre tanto, el servidor responde 409 y se recarga.
 */
export default function ModalProgramar({ preseleccion, onCerrar, onProgramada }: ModalProgramarProps) {
  const { referidoId, usuariaId: usuariaPreseleccionada } = preseleccion
  const cargarProgramables = useCallback(
    () => listarProgramables({ referidoId, usuariaId: usuariaPreseleccionada }),
    [referidoId, usuariaPreseleccionada],
  )
  const { datos: programables, error: errorLista, recargar: recargarLista } = useRecurso(cargarProgramables)
  const horario = useHorario()
  const [usuariaElegida, setUsuariaId] = useState('')
  const [ninoId, setNinoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Una clave por contenido: reintentar lo mismo (doble clic, red) no abre dos atenciones.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  const hayPreseleccion = Boolean(referidoId || usuariaPreseleccionada)
  // Si se abrió para una paciente concreta, queda elegida sin que la usuaria tenga que tocar nada.
  const usuariaId = usuariaElegida || (programables?.length === 1 && hayPreseleccion ? programables[0].usuariaId : '')

  const paciente = programables?.find((uno) => uno.usuariaId === usuariaId) ?? null
  const abreAtencion = paciente !== null && paciente.atencionActiva === null
  const titulo = abreAtencion ? 'Agendar primera consulta' : 'Programar consulta'
  const subtitulo =
    hayPreseleccion && paciente
      ? `${paciente.usuariaNombreCompleto} · Exp. ${paciente.expedienteNumero}`
      : 'Elige la paciente, la fecha y la hora.'

  async function guardar() {
    if (!paciente) {
      setError('Elige la paciente.')
      return
    }
    if (!horario.fecha || !horario.hora) {
      setError('Elige el día y la hora.')
      return
    }
    const datos: ProgramarCitaMedicaInput = {
      ...(paciente.referidoId && abreAtencion ? { referidoId: paciente.referidoId } : { expedienteId: paciente.expedienteId }),
      ninoId,
      inicio: `${horario.fecha}T${horario.hora}`,
    }
    const firma = JSON.stringify(datos)
    if (idempotencia.current?.firma !== firma) idempotencia.current = { firma, clave: crypto.randomUUID() }

    setError(null)
    setGuardando(true)
    try {
      onProgramada(await programarCita(datos, idempotencia.current.clave))
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

  const listo = paciente !== null && horario.fecha !== null && horario.hora !== null

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
          <Button tamano="md" onClick={() => void guardar()} disabled={!listo} cargando={guardando}>
            {titulo}
          </Button>
        </>
      }
    >
      {errorLista ? (
        <ErrorVista mensaje={errorLista.mensaje} sinPermiso={errorLista.sinPermiso} onReintentar={() => void recargarLista()} />
      ) : !programables ? (
        <Esqueleto filas={2} />
      ) : programables.length === 0 ? (
        <p className="rounded-lg bg-[#f8f9fa] px-3 py-2.5 text-sm text-[#5b6573]">
          No hay pacientes a las que se pueda programar una consulta.
        </p>
      ) : (
        <>
          {!hayPreseleccion && (
            <label className="block space-y-1.5 text-[13px] font-medium text-[#1c2430]">
              Paciente
              <select
                value={usuariaId}
                onChange={(evento) => {
                  setUsuariaId(evento.target.value)
                  setNinoId(null)
                  setError(null)
                }}
                className={CLASE_CAMPO}
              >
                <option value="">Selecciona…</option>
                {programables.map((uno) => (
                  <option key={uno.usuariaId} value={uno.usuariaId}>
                    {uno.usuariaNombreCompleto} · Exp. {uno.expedienteNumero}
                  </option>
                ))}
              </select>
            </label>
          )}

          {paciente && abreAtencion && paciente.motivoReferencia && (
            <div className="rounded-lg border border-[#e3e6ea] bg-[#f8f9fa] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6573]">
                Motivo de referencia · Trabajo Social
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-[#1c2430]">{paciente.motivoReferencia}</p>
            </div>
          )}

          {paciente && paciente.personas.length > 1 && (
            <SelectorPersona personas={paciente.personas} ninoId={ninoId} onElegir={setNinoId} />
          )}

          {horario.error ? (
            <ErrorVista mensaje={horario.error.mensaje} onReintentar={() => void horario.recargar()} />
          ) : !horario.disponibilidad ? (
            <Esqueleto filas={1} />
          ) : (
            <SelectorHorario
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

          {paciente && (
            <div className="flex items-center gap-3 rounded-lg border border-[#e6dbf3] bg-[#f7f3fc] px-3.5 py-3">
              <span
                aria-hidden="true"
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#7346a5] text-white"
              >
                <Plus className="h-4 w-4" />
              </span>
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold text-[#5b3985]">{abreAtencion ? 'Primera consulta' : 'Consulta'}</p>
                <p className="text-[#1c2430]">
                  {horario.fecha && horario.hora ? `${fechaLarga(horario.fecha)} · ${horario.hora}` : 'Elige una hora'}
                </p>
                {abreAtencion && paciente.codigoNuevaAtencion && (
                  <p className="text-[#5b6573]">
                    Se abre la atención <strong className="font-mono font-semibold">{paciente.codigoNuevaAtencion}</strong>
                  </p>
                )}
                {paciente.atencionActiva && (
                  <p className="text-[#5b6573]">
                    Atención <span className="font-mono">{paciente.atencionActiva.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#9b2c20]">
          {error}
        </p>
      )}
    </ModalMedica>
  )
}
