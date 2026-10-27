import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { diasDesdeGT, ETIQUETAS_FILTRO_PACIENTES_MEDICA, MIN_LETRAS_BUSCADOR_PACIENTES_MEDICA } from '@akyuam/shared'
import type { PacienteBuscadaMedicaDto } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { buscarPacientesProgramables } from '../api/medica.api'
import Chip from './Chip'
import { CLASE_CAMPO, TONO_SITUACION } from './estilos'
import { fechaCorta } from './fechas'

/** Espera tras la última tecla antes de buscar: no se pide al servidor una vez por letra. */
const ESPERA_MS = 300
// Los mismos formatos que reconoce el servidor (`interpretarBusqueda`).
const PATRON_EXPEDIENTE = /^\d{1,4}-\d{4}$/
const PATRON_DPI = /^\d{13}$/

function esBuscable(termino: string) {
  return PATRON_EXPEDIENTE.test(termino) || PATRON_DPI.test(termino) || termino.length >= MIN_LETRAS_BUSCADOR_PACIENTES_MEDICA
}

/** Respuesta del servidor y el texto que la produjo, para no mostrar resultados de otra búsqueda como vigentes. */
interface Respuesta {
  para: string
  items?: PacienteBuscadaMedicaDto[]
  error?: string
}

interface BuscadorPacienteProps {
  etiqueta: string
  /** Solo pacientes en una situación; sin ella, en atención y por agendar. */
  situacion?: PacienteBuscadaMedicaDto['situacion']
  /** Antes de escribir, mostrar las por agendar que más esperan. */
  conSugerencias: boolean
  elegida: PacienteBuscadaMedicaDto | null
  onElegir: (paciente: PacienteBuscadaMedicaDto | null) => void
  enfocarAlAbrir?: boolean
}

function textoEspera(referidaEl: string): string {
  const dias = diasDesdeGT(referidaEl)
  return dias === 0 ? 'Referida hoy' : dias === 1 ? 'Espera 1 día' : `Espera ${dias} días`
}

function Detalle({ paciente }: { paciente: PacienteBuscadaMedicaDto }) {
  return (
    <span className="text-xs text-[#5b6573]">
      Exp. {paciente.expedienteNumero}
      {paciente.hijos > 0 ? ` · ${paciente.hijos} ${paciente.hijos === 1 ? 'hijo/a' : 'hijos/as'}` : ''}
      {paciente.proximaCita ? ` · Próxima cita ${fechaCorta(paciente.proximaCita.fecha)}, ${paciente.proximaCita.hora}` : ''}
    </span>
  )
}

/**
 * Buscador de pacientes (combobox WAI-ARIA): se escribe nombre, DPI o número de expediente y el
 * servidor devuelve unas pocas coincidencias. Nunca se descarga la lista completa de pacientes.
 * El texto buscado vive solo en este estado: no va a la URL ni al almacenamiento del navegador.
 * Teclado: ↑ ↓ recorren, Enter elige, Esc borra el texto (con el texto vacío cierra el modal).
 */
export default function BuscadorPaciente({
  etiqueta,
  situacion,
  conSugerencias,
  elegida,
  onElegir,
  enfocarAlAbrir = false,
}: BuscadorPacienteProps) {
  const id = useId()
  const idLista = `${id}-lista`
  const entrada = useRef<HTMLInputElement>(null)
  const quiereFoco = useRef(enfocarAlAbrir)
  const turno = useRef(0)
  const [texto, setTexto] = useState('')
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null)
  const [activo, setActivo] = useState(-1)

  const termino = texto.trim()
  const modo = !termino ? (conSugerencias ? 'sugerencias' : 'vacio') : esBuscable(termino) ? 'busqueda' : 'corto'
  const consulta = modo === 'sugerencias' || modo === 'busqueda'

  useEffect(() => {
    if (!consulta) return
    const miTurno = ++turno.current
    const pedido = window.setTimeout(
      () => {
        buscarPacientesProgramables({ q: termino || undefined, situacion })
          .then((items) => {
            if (miTurno !== turno.current) return
            setRespuesta({ para: termino, items })
            setActivo(-1)
          })
          .catch((err: unknown) => {
            if (miTurno === turno.current) setRespuesta({ para: termino, error: extraerMensajeError(err) })
          })
      },
      termino ? ESPERA_MS : 0,
    )
    return () => window.clearTimeout(pedido)
  }, [consulta, termino, situacion])

  // Tras "Cambiar" (o al abrir el modal) el foco vuelve al campo. Va en un setTimeout para que el
  // modal, que enfoca su panel al montarse, no se lo quite.
  useEffect(() => {
    if (elegida || !quiereFoco.current) return
    quiereFoco.current = false
    window.setTimeout(() => entrada.current?.focus(), 0)
  }, [elegida])

  useEffect(() => {
    if (activo >= 0) document.getElementById(`${idLista}-${activo}`)?.scrollIntoView({ block: 'nearest' })
  }, [activo, idLista])

  if (elegida) {
    return (
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-[#1c2430]">{etiqueta}</p>
        <div className="flex items-center justify-between gap-3 rounded-md border border-[#e6dbf3] bg-[#f7f3fc] px-3.5 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span className="text-[13.5px] font-semibold text-[#1c2430]">{elegida.nombreCompleto}</span>
            <Detalle paciente={elegida} />
          </span>
          <button
            type="button"
            onClick={() => {
              quiereFoco.current = true
              onElegir(null)
            }}
            className="flex-none rounded-md px-2 py-1 text-[13px] font-semibold text-[#7346a5] hover:bg-white"
          >
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  const vigente = respuesta !== null && respuesta.para === termino
  const items = consulta && respuesta?.items ? respuesta.items : []
  const error = consulta && vigente ? respuesta.error : undefined
  const sinCoincidencias = modo === 'busqueda' && vigente && respuesta.items?.length === 0

  function elegir(paciente: PacienteBuscadaMedicaDto) {
    onElegir(paciente)
  }

  function onTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' && items.length > 0) {
      evento.preventDefault()
      setActivo((actual) => (actual + 1) % items.length)
    } else if (evento.key === 'ArrowUp' && items.length > 0) {
      evento.preventDefault()
      setActivo((actual) => (actual <= 0 ? items.length - 1 : actual - 1))
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      // Solo con resultados del texto actual: nunca elegir por una lista que está por cambiar.
      if (vigente && items[activo]) elegir(items[activo])
    } else if (evento.key === 'Escape' && texto) {
      // Esc con texto lo borra; no llega al modal (que se cerraría).
      evento.stopPropagation()
      setTexto('')
      setActivo(-1)
    }
  }

  const estadoLectores = !consulta
    ? ''
    : !vigente
      ? 'Buscando…'
      : error
        ? error
        : `${items.length} ${modo === 'sugerencias' ? 'sugerencias' : items.length === 1 ? 'resultado' : 'resultados'}`

  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-campo`} className="block text-[13px] font-medium text-[#1c2430]">
        {etiqueta}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6573]"
        />
        <input
          ref={entrada}
          id={`${id}-campo`}
          type="text"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 && items[activo] ? `${idLista}-${activo}` : undefined}
          aria-describedby={`${id}-ayuda`}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          value={texto}
          placeholder="Escribe nombre, DPI o expediente"
          onChange={(evento) => {
            setTexto(evento.target.value)
            setActivo(-1)
          }}
          onKeyDown={onTecla}
          className={`${CLASE_CAMPO} pl-9`}
        />
      </div>

      <p id={`${id}-ayuda`} className="text-xs text-[#5b6573]">
        {modo === 'corto'
          ? `Escribe al menos ${MIN_LETRAS_BUSCADOR_PACIENTES_MEDICA} letras, el DPI completo o el expediente (p. ej. 12-2026).`
          : modo === 'vacio'
            ? 'Busca por nombre, DPI o número de expediente.'
            : modo === 'sugerencias'
              ? 'Por agendar, de la que más espera a la que menos. Escribe para buscar a otra paciente.'
              : 'Hasta 10 coincidencias; si no ves a la paciente, escribe más del nombre.'}
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {estadoLectores}
      </p>

      {error ? (
        <p role="alert" className="text-[12.5px] text-[#9b2c20]">
          {error}
        </p>
      ) : sinCoincidencias ? (
        <p className="rounded-md bg-[#f8f9fa] px-3 py-2.5 text-[13px] text-[#5b6573]">
          Ninguna paciente coincide. El DPI lleva 13 dígitos y el expediente va completo (p. ej. 12-2026).
        </p>
      ) : consulta && !respuesta ? (
        <p className="px-1 text-[13px] text-[#5b6573]">Buscando…</p>
      ) : modo === 'sugerencias' && vigente && items.length === 0 ? (
        <p className="px-1 text-[13px] text-[#5b6573]">No hay pacientes por agendar.</p>
      ) : null}

      {items.length > 0 && !error && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={modo === 'sugerencias' ? 'Sugerencias por agendar' : 'Pacientes encontradas'}
          aria-busy={!vigente}
          className={`max-h-[288px] divide-y divide-[#eef0f2] overflow-y-auto rounded-lg border border-[#e3e6ea] ${
            vigente ? '' : 'opacity-60'
          }`}
        >
          {items.map((paciente, indice) => (
            <li
              key={paciente.usuariaId}
              id={`${idLista}-${indice}`}
              role="option"
              aria-selected={indice === activo}
              // mousedown sin foco: el campo no pierde el foco al hacer clic en una opción.
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => elegir(paciente)}
              onMouseEnter={() => setActivo(indice)}
              className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 ${
                indice === activo ? 'bg-[#f2ecfa]' : 'bg-white'
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[13.5px] font-medium text-[#1c2430]">{paciente.nombreCompleto}</span>
                <Detalle paciente={paciente} />
              </span>
              {/* En las sugerencias todas están por agendar: lo que ayuda a decidir es cuánto llevan esperando. */}
              {modo === 'sugerencias' && paciente.referidaEl ? (
                <span className="whitespace-nowrap text-xs font-medium text-[#8a5a14]">{textoEspera(paciente.referidaEl)}</span>
              ) : (
                <Chip tono={TONO_SITUACION[paciente.situacion]}>{ETIQUETAS_FILTRO_PACIENTES_MEDICA[paciente.situacion]}</Chip>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
