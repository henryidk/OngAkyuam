import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { buscarUsuariasGlobal } from '../api/trabajoSocial.api'
import { LARGO_MINIMO_BUSQUEDA } from '../usuarias/filaUsuaria'
import { subtituloResultadoBusqueda } from './textoBusquedaGlobal'

const ESPERA_BUSQUEDA_MS = 350
const MAXIMO_RESULTADOS_MOSTRADOS = 8
const ID_LISTBOX = 'buscador-global-ts-listbox'

function idOpcion(indice: number): string {
  return `buscador-global-ts-opcion-${indice}`
}

/**
 * Buscador global del header de Trabajo Social (plan §12.2): nombre, DPI o número de expediente
 * en un solo campo. El término nunca se pone en la URL, para no dejarlo en el historial.
 */
export default function BuscadorGlobalTs() {
  const navigate = useNavigate()
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<UsuariaResumenBusqueda[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(-1)

  const terminoValido = texto.trim().length >= LARGO_MINIMO_BUSQUEDA ? texto.trim() : ''

  useEffect(() => {
    if (!terminoValido) {
      setResultados([])
      setError(null)
      setCargando(false)
      return
    }
    setCargando(true)
    const temporizador = setTimeout(async () => {
      try {
        const datos = await buscarUsuariasGlobal(terminoValido)
        setResultados(datos.slice(0, MAXIMO_RESULTADOS_MOSTRADOS))
        setError(null)
      } catch (err) {
        setError(extraerMensajeError(err))
        setResultados([])
      } finally {
        setCargando(false)
      }
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [terminoValido])

  useEffect(() => {
    setIndiceActivo(-1)
  }, [resultados])

  useEffect(() => {
    if (!abierto) return
    function alHacerClicFuera(evento: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', alHacerClicFuera)
    return () => document.removeEventListener('mousedown', alHacerClicFuera)
  }, [abierto])

  function irAUsuaria(usuariaId: string) {
    setTexto('')
    setResultados([])
    setAbierto(false)
    navigate(`/trabajo-social/usuarias/${usuariaId}`)
  }

  function alPresionarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (!abierto || resultados.length === 0) return
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setIndiceActivo((actual) => (actual + 1) % resultados.length)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceActivo((actual) => (actual <= 0 ? resultados.length - 1 : actual - 1))
    } else if (evento.key === 'Enter' && indiceActivo >= 0) {
      evento.preventDefault()
      irAUsuaria(resultados[indiceActivo].id)
    } else if (evento.key === 'Escape') {
      setAbierto(false)
    }
  }

  const mostrarDropdown = abierto && terminoValido.length > 0

  return (
    <div ref={contenedorRef} className="relative w-64">
      <label className="relative block">
        <span className="sr-only">Buscar usuaria por nombre, DPI o número de expediente</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          role="combobox"
          aria-expanded={mostrarDropdown}
          aria-controls={ID_LISTBOX}
          aria-activedescendant={indiceActivo >= 0 ? idOpcion(indiceActivo) : undefined}
          autoComplete="off"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alPresionarTecla}
          placeholder="Buscar usuaria…"
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {mostrarDropdown && (
        <ul
          id={ID_LISTBOX}
          role="listbox"
          className="absolute right-0 z-20 mt-1 max-h-80 w-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {cargando && <li className="px-3 py-2 text-sm text-gray-500">Buscando…</li>}
          {!cargando && error && <li className="px-3 py-2 text-sm text-red-600">{error}</li>}
          {!cargando && !error && resultados.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">Ninguna usuaria coincide.</li>
          )}
          {!cargando &&
            !error &&
            resultados.map((item, indice) => (
              <li
                key={item.id}
                id={idOpcion(indice)}
                role="option"
                aria-selected={indice === indiceActivo}
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => irAUsuaria(item.id)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  indice === indiceActivo ? 'bg-brand-50 text-brand-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <p className="font-medium">
                  {item.nombres} {item.apellidos}
                </p>
                <p className="text-xs text-gray-500">{subtituloResultadoBusqueda(item)}</p>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
