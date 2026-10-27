import { useState } from 'react'
import { hoyGT, type DuracionCitaMedica, type PersonaAtendidaDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import ModalMedica from '../compartido/ModalMedica'
import ResumenCita from '../compartido/ResumenCita'
import SelectorDuracion from '../compartido/SelectorDuracion'
import SelectorHorario from '../compartido/SelectorHorario'
import SelectorPersonasCita from '../compartido/SelectorPersonasCita'
import { useHorario } from '../compartido/useHorario'

/** Lo elegido para la próxima consulta: se agenda junto con la consulta, al guardarla. */
export interface ProximaElegida {
  fecha: string
  hora: string
  duracionMin: DuracionCitaMedica
  personas: (string | null)[]
}

interface ModalProximaConsultaProps {
  /** Todas las personas del expediente (la usuaria primero). */
  personas: PersonaAtendidaDto[]
  usuariaNombreCompleto: string
  /** Lo elegido antes, o los valores por defecto (las personas de esta visita y su duración). */
  inicial: { fecha?: string; hora?: string; duracionMin: DuracionCitaMedica; personas: (string | null)[] }
  /** Por qué se reabrió el modal (la hora elegida se ocupó al guardar). */
  aviso?: string | null
  onCerrar: () => void
  onElegir: (proxima: ProximaElegida) => void
}

/**
 * Próxima consulta desde Registrar consulta: las mismas piezas del modal de Agenda (personas,
 * duración, día y hora libres, confirmación), pero no guarda nada — devuelve lo elegido y el
 * formulario lo agenda al guardar la consulta, todo junto. Solo se sale con Cancelar.
 */
export default function ModalProximaConsulta({
  personas,
  usuariaNombreCompleto,
  inicial,
  aviso,
  onCerrar,
  onElegir,
}: ModalProximaConsultaProps) {
  const [elegidas, setElegidas] = useState<(string | null)[]>(inicial.personas)
  const [duracion, setDuracion] = useState<DuracionCitaMedica>(inicial.duracionMin)
  // Nunca el mismo día de la consulta que se está registrando.
  const [hoy] = useState(() => hoyGT())
  const horario = useHorario({ fecha: inicial.fecha, hora: inicial.hora, despuesDe: hoy, duracion })
  const [confirmando, setConfirmando] = useState(false)

  const atendidas = personas.filter((persona) => elegidas.includes(persona.ninoId))
  const listo = atendidas.length > 0 && horario.fecha !== null && horario.hora !== null

  return (
    <ModalMedica
      titulo="Próxima consulta"
      subtitulo={confirmando ? 'Revisa los datos: se agenda al guardar la consulta.' : 'Elige el día y la hora.'}
      soloConCancelar
      onCerrar={onCerrar}
      pie={
        <>
          <Button variante="secondary" tamano="md" onClick={onCerrar}>
            Cancelar
          </Button>
          {confirmando ? (
            <>
              <Button variante="secondary" tamano="md" onClick={() => setConfirmando(false)}>
                Volver
              </Button>
              <Button
                tamano="md"
                onClick={() => {
                  if (!horario.fecha || !horario.hora) return
                  onElegir({
                    fecha: horario.fecha,
                    hora: horario.hora,
                    duracionMin: duracion,
                    personas: atendidas.map((persona) => persona.ninoId),
                  })
                }}
              >
                Usar esta fecha
              </Button>
            </>
          ) : (
            <Button tamano="md" onClick={() => setConfirmando(true)} disabled={!listo}>
              Continuar
            </Button>
          )}
        </>
      }
    >
      {confirmando && horario.fecha && horario.hora ? (
        <ResumenCita
          encabezado="Próxima consulta de"
          atendidas={atendidas}
          usuariaNombreCompleto={usuariaNombreCompleto}
          fecha={horario.fecha}
          hora={horario.hora}
          duracion={duracion}
          pie="Se agrega a la agenda al guardar la consulta."
        />
      ) : (
        <>
          {aviso && (
            <p role="alert" className="rounded-lg bg-[#fdf1ef] px-3 py-2.5 text-sm text-[#9b2c20]">
              {aviso}
            </p>
          )}

          {personas.length > 1 && (
            <SelectorPersonasCita personas={personas} elegidas={elegidas} obligatorias={false} onCambiar={setElegidas} />
          )}

          <SelectorDuracion duracion={duracion} personas={atendidas.length} onCambiar={setDuracion} />

          {horario.error ? (
            <ErrorVista mensaje={horario.error.mensaje} onReintentar={() => void horario.recargar()} />
          ) : !horario.disponibilidad ? (
            <Esqueleto filas={1} />
          ) : (
            <SelectorHorario
              disponibilidad={horario.disponibilidad}
              fecha={horario.fecha}
              hora={horario.hora}
              onFecha={horario.elegirFecha}
              onHora={horario.elegirHora}
            />
          )}
        </>
      )}
    </ModalMedica>
  )
}
