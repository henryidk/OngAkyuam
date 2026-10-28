import { useCallback, useRef, useState } from 'react'
import axios from 'axios'
import {
  DURACION_CITA_MEDICA_MIN,
  type CitaMedicaProgramadaDto,
  type DuracionCitaMedica,
  type PacienteBuscadaMedicaDto,
  type ProgramablesMedicaQuery,
  type ProgramarCitaMedicaInput,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { extraerMensajeError } from '../../../lib/errors'
import { useRecurso } from '../../../lib/useRecurso'
import { listarProgramables, programarCita } from '../api/medica.api'
import BuscadorPaciente from './BuscadorPaciente'
import ModalMedica from './ModalMedica'
import ResumenCita from './ResumenCita'
import SelectorDuracion from './SelectorDuracion'
import SelectorHorario from './SelectorHorario'
import SelectorPersonasCita from './SelectorPersonasCita'
import { esConflictoHorario, MENSAJE_HORARIO_TOMADO, useHorario } from './useHorario'

interface ModalProgramarProps {
  /** Paciente ya elegida (desde una referencia o desde la ficha); vacío = se elige en el modal. */
  preseleccion: ProgramablesMedicaQuery
  /** Día que se propone primero (el abierto en la agenda); si no tiene horas libres, el primero que sí. */
  fechaPreferida?: string | null
  onCerrar: () => void
  onProgramada: (cita: CitaMedicaProgramadaDto) => void
}

/** El servidor rechazó la primera consulta porque cambió la lista de hijos/as del expediente. */
function esConflictoPersonas(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return false
  return (err.response.data as { codigo?: string } | undefined)?.codigo === 'PERSONAS_PRIMERA_CONSULTA'
}

/**
 * Programar una consulta, en tres pasos: 1) la paciente, 2) el día y la hora, 3) confirmar. Elegir
 * a la paciente avanza solo, y la tarjeta de la paciente del paso 2 tiene "Cambiar" para regresar
 * al 1. Con preselección se abre en el paso 2. Solo se sale con Cancelar: tocar fuera o Esc no
 * cierran, para no perder lo elegido por accidente.
 *
 * En el paso 2 se elige también a quiénes se atiende (la usuaria y/o sus hijos/as) y la duración.
 * Si la paciente no tiene atención activa (primera consulta o regresa tras un alta), al guardar se
 * abre la atención, y esa primera consulta es para la usuaria y todos sus hijos/as. Solo se ofrecen horas libres del horario de la
 * médica; si otra persona toma la misma hora entre tanto, el servidor responde 409 y se recarga.
 *
 * Sin preselección, la paciente se busca con `BuscadorPaciente` y solo entonces se pide su
 * detalle (motivo de referencia, hijos, atención): nunca se carga el de todas las pacientes.
 */
export default function ModalProgramar({ preseleccion, fechaPreferida, onCerrar, onProgramada }: ModalProgramarProps) {
  const { referidoId, usuariaId: usuariaPreseleccionada } = preseleccion
  const hayPreseleccion = Boolean(referidoId || usuariaPreseleccionada)
  const [elegida, setElegida] = useState<PacienteBuscadaMedicaDto | null>(null)
  const usuariaId = usuariaPreseleccionada ?? elegida?.usuariaId
  const cargarProgramables = useCallback(
    () => (referidoId || usuariaId ? listarProgramables({ referidoId, usuariaId }) : Promise.resolve(null)),
    [referidoId, usuariaId],
  )
  const {
    datos: programables,
    error: errorLista,
    cargando: cargandoDetalle,
    recargar: recargarLista,
  } = useRecurso(cargarProgramables)
  const [duracion, setDuracion] = useState<DuracionCitaMedica>(DURACION_CITA_MEDICA_MIN)
  const horario = useHorario({ fecha: fechaPreferida, duracion })
  const [motivoCompleto, setMotivoCompleto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  // Lo que marcó la médica; `null` mientras no toque nada (por defecto, solo la usuaria).
  const [marcadas, setMarcadas] = useState<(string | null)[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Una clave por contenido: reintentar lo mismo (doble clic, red) no abre dos atenciones.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  const conPaciente = hayPreseleccion || elegida !== null
  // Al cambiar de paciente, el detalle anterior sigue en memoria un instante: nunca se usa.
  const detalle = conPaciente ? programables?.filter((uno) => !elegida || uno.usuariaId === elegida.usuariaId) : undefined
  // Si la usuaria tiene más de un expediente referido, se programa en el de la atención activa.
  const paciente = detalle?.find((uno) => uno.atencionActiva !== null) ?? detalle?.[0] ?? null
  const abreAtencion = paciente !== null && paciente.atencionActiva === null
  // La primera consulta lleva siempre a todas las personas del expediente.
  const personasElegidas = !paciente
    ? []
    : abreAtencion
      ? paciente.personas.map((persona) => persona.ninoId)
      : (marcadas ?? [null]).filter((id) => paciente.personas.some((persona) => persona.ninoId === id))
  const titulo = abreAtencion ? 'Agendar primera consulta' : 'Programar consulta'
  const subtitulo = hayPreseleccion
    ? confirmando
      ? 'Revisa los datos y confirma la cita.'
      : 'Elige el día y la hora.'
    : confirmando
      ? 'Paso 3 de 3 · Confirma la cita'
      : conPaciente
        ? 'Paso 2 de 3 · Elige el día y la hora'
        : 'Paso 1 de 3 · Elige a la paciente'

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
      personas: personasElegidas,
      duracionMin: duracion,
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
        // De vuelta a elegir: la hora confirmada ya no está libre.
        setConfirmando(false)
        setError(MENSAJE_HORARIO_TOMADO)
        void horario.recargar()
      } else if (esConflictoPersonas(err)) {
        // Trabajo Social agregó un hijo/a mientras el modal estaba abierto: se recarga la lista.
        setConfirmando(false)
        setError(extraerMensajeError(err))
        void recargarLista()
      } else {
        setError(extraerMensajeError(err))
      }
    } finally {
      setGuardando(false)
    }
  }

  const listo = paciente !== null && personasElegidas.length > 0 && horario.fecha !== null && horario.hora !== null
  const nombre = paciente?.usuariaNombreCompleto ?? elegida?.nombreCompleto
  const expediente = paciente?.expedienteNumero ?? elegida?.expedienteNumero
  const atendidas = paciente?.personas.filter((una) => personasElegidas.includes(una.ninoId)) ?? []
  const motivoLargo = Boolean(paciente?.motivoReferencia && (paciente.motivoReferencia.length > 90 || paciente.motivoReferencia.includes('\n')))

  return (
    <ModalMedica
      titulo={titulo}
      subtitulo={subtitulo}
      ocupado={guardando}
      soloConCancelar
      onCerrar={onCerrar}
      pie={
        <>
          <Button variante="secondary" tamano="md" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          {confirmando ? (
            <>
              <Button
                variante="secondary"
                tamano="md"
                onClick={() => {
                  setConfirmando(false)
                  setError(null)
                }}
                disabled={guardando}
              >
                Volver
              </Button>
              <Button tamano="md" onClick={() => void guardar()} cargando={guardando}>
                Confirmar cita
              </Button>
            </>
          ) : (
            conPaciente && (
              <Button
                tamano="md"
                onClick={() => {
                  setError(null)
                  setConfirmando(true)
                }}
                disabled={!listo}
              >
                Continuar
              </Button>
            )
          )}
        </>
      }
    >
      {/* Paso 3: un resumen tipo aviso con la fecha y la hora bien visibles antes de guardar. */}
      {confirmando && paciente && horario.fecha && horario.hora && (
        <ResumenCita
          encabezado={abreAtencion ? 'Primera consulta de' : 'Consulta de'}
          atendidas={atendidas}
          usuariaNombreCompleto={paciente.usuariaNombreCompleto}
          fecha={horario.fecha}
          hora={horario.hora}
          duracion={duracion}
          pie={
            <>
              Exp. {paciente.expedienteNumero}
              {abreAtencion && paciente.codigoNuevaAtencion && (
                <>
                  {' · Se abre la atención '}
                  <strong className="font-mono font-semibold">{paciente.codigoNuevaAtencion}</strong>
                </>
              )}
              {paciente.atencionActiva && (
                <>
                  {' · Atención '}
                  <span className="font-mono">{paciente.atencionActiva.codigo}</span>
                </>
              )}
            </>
          }
        />
      )}

      {/* Paso 1: el buscador. Al elegir a la paciente se pasa solo al paso 2. */}
      {!confirmando && !conPaciente && (
        <BuscadorPaciente
          etiqueta="Paciente"
          conSugerencias
          elegida={null}
          onElegir={(nueva) => {
            setElegida(nueva)
            setMarcadas(null)
            setMotivoCompleto(false)
            setError(null)
          }}
          enfocarAlAbrir
        />
      )}

      {/* Paso 2: la paciente (con el motivo y la atención) en una sola tarjeta, y debajo día y hora. */}
      {!confirmando && conPaciente && (
        <div className="rounded-lg border border-[#e6dbf3] bg-[#f7f3fc] px-3.5 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-[#1c2430]">{nombre ?? 'Cargando…'}</p>
              {expediente && (
                <p className="text-xs text-[#5b6573]">
                  Exp. {expediente}
                  {paciente?.atencionActiva && (
                    <>
                      {' · Atención '}
                      <span className="font-mono">{paciente.atencionActiva.codigo}</span>
                    </>
                  )}
                  {abreAtencion && paciente?.codigoNuevaAtencion && (
                    <>
                      {' · Se abre la atención '}
                      <strong className="font-mono font-semibold">{paciente.codigoNuevaAtencion}</strong>
                    </>
                  )}
                </p>
              )}
            </div>
            {!hayPreseleccion && (
              <button
                type="button"
                onClick={() => {
                  setElegida(null)
                  setError(null)
                }}
                className="flex-none rounded-md px-2 py-1 text-[13px] font-semibold text-[#7346a5] hover:bg-white"
              >
                Cambiar
              </button>
            )}
          </div>
          {abreAtencion && paciente.motivoReferencia && (
            <div className="mt-1.5 border-t border-[#e6dbf3] pt-1.5 text-[12.5px] text-[#1c2430]">
              <p className={`whitespace-pre-line ${motivoCompleto ? '' : 'line-clamp-1'}`}>
                <span className="font-semibold text-[#5b3985]">Motivo: </span>
                {paciente.motivoReferencia}
              </p>
              {motivoLargo && (
                <button
                  type="button"
                  onClick={() => setMotivoCompleto((actual) => !actual)}
                  className="text-[12px] font-semibold text-[#7346a5] hover:underline"
                >
                  {motivoCompleto ? 'Ver menos' : 'Ver todo'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!confirmando &&
        conPaciente &&
        (errorLista ? (
          <ErrorVista mensaje={errorLista.mensaje} sinPermiso={errorLista.sinPermiso} onReintentar={() => void recargarLista()} />
        ) : cargandoDetalle || !detalle ? (
          <Esqueleto filas={2} />
        ) : !paciente ? (
          <p className="rounded-lg bg-[#f8f9fa] px-3 py-2.5 text-sm text-[#5b6573]">
            Esta paciente ya no se puede programar: no tiene una referencia pendiente ni una atención activa.
          </p>
        ) : (
          <>
            {paciente.personas.length > 1 && (
              <SelectorPersonasCita
                personas={paciente.personas}
                elegidas={personasElegidas}
                obligatorias={abreAtencion}
                onCambiar={(nuevas) => {
                  setMarcadas(nuevas)
                  setError(null)
                }}
              />
            )}

            <SelectorDuracion
              duracion={duracion}
              personas={personasElegidas.length}
              onCambiar={(nueva) => {
                setDuracion(nueva)
                setError(null)
              }}
            />

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
          </>
        ))}

      {error && (
        <p role="alert" className="text-sm text-[#9b2c20]">
          {error}
        </p>
      )}
    </ModalMedica>
  )
}
