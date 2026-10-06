import { useId, useState } from 'react'
import { municipioDelCatalogo, municipiosDeDepartamento, normalizarEspacios } from '@akyuam/shared'
import Campo, { claseBordeCampo, idDescripcionCampo } from './Campo'

/** Valor interno del select para "no está en la lista": nunca se guarda. */
const OPCION_OTRO = '__otro__'

const CLASE_CONTROL =
  'mt-1 w-full rounded border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

interface CampoMunicipioFueraProps {
  /** Departamento ya elegido (vacío: todavía no se eligió). */
  departamento: string
  /** Valor guardado en el formulario (`municipioOtro`): uno de la lista o el escrito a mano. */
  valor: string
  onCambiar: (valor: string) => void
  onBlur?: () => void
  /** Ref de react-hook-form, para llevar el foco al campo cuando tiene error. */
  campoRef?: (elemento: HTMLSelectElement | HTMLInputElement | null) => void
  label?: string
  error?: string
  modificado?: boolean
}

/**
 * Municipio de una usuaria de fuera de Alta Verapaz: lista de los municipios del departamento
 * elegido y, al final, "Otro" para escribirlo a mano si no aparece.
 *
 * Quien lo usa debe montarlo con `key={departamento}`: al cambiar de departamento el municipio
 * anterior deja de aplicar y el componente vuelve a empezar (sin "Otro" elegido).
 */
export default function CampoMunicipioFuera({
  departamento,
  valor,
  onCambiar,
  onBlur,
  campoRef,
  label = 'Municipio',
  error,
  modificado,
}: CampoMunicipioFueraProps) {
  const idSelect = useId()
  const idTexto = useId()
  const municipios = ordenarAlfabeticamente(municipiosDeDepartamento(departamento))
  const enLaLista = municipios.includes(valor)
  // Un valor guardado que no está en la lista es uno escrito a mano: se abre directo en "Otro".
  const [escribiendo, setEscribiendo] = useState(valor !== '' && !enLaLista)
  // Si el valor cambia desde fuera (descartar cambios, reiniciar el formulario), el modo se
  // recalcula a partir de él; lo que este componente emite no cuenta como cambio externo.
  const [ultimoEmitido, setUltimoEmitido] = useState(valor)
  if (valor !== ultimoEmitido) {
    setUltimoEmitido(valor)
    setEscribiendo(valor !== '' && !enLaLista)
  }

  function emitir(nuevo: string) {
    setUltimoEmitido(nuevo)
    onCambiar(nuevo)
  }

  const sinDepartamento = municipios.length === 0
  // Lo escrito a mano ya está en la lista (con otra escritura): se ofrece elegirlo en un clic.
  const sugerido = escribiendo ? municipioDelCatalogo(departamento, valor) : null
  const errorVisible = sugerido ? undefined : error

  function onSelectCambia(seleccion: string) {
    if (seleccion === OPCION_OTRO) {
      setEscribiendo(true)
      emitir('')
      return
    }
    setEscribiendo(false)
    emitir(seleccion)
  }

  function usarSugerido(municipio: string) {
    setEscribiendo(false)
    emitir(municipio)
  }

  // Con "Otro" elegido, el error se muestra bajo el texto, que es donde se corrige.
  const errorSelect = escribiendo ? undefined : errorVisible
  const ayudaSelect = sinDepartamento ? 'Elige primero el departamento.' : undefined

  return (
    <Campo
      label={label}
      htmlFor={idSelect}
      error={errorSelect}
      ayuda={ayudaSelect}
      modificado={modificado}
    >
      <select
        id={idSelect}
        ref={escribiendo ? undefined : campoRef}
        value={escribiendo ? OPCION_OTRO : enLaLista ? valor : ''}
        onChange={(evento) => onSelectCambia(evento.target.value)}
        onBlur={escribiendo ? undefined : onBlur}
        disabled={sinDepartamento}
        aria-invalid={errorSelect ? true : undefined}
        aria-describedby={idDescripcionCampo(idSelect, { error: errorSelect, ayuda: ayudaSelect })}
        className={`${CLASE_CONTROL} bg-white disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${claseBordeCampo({ error: errorSelect, modificado })}`}
      >
        <option value="">{sinDepartamento ? 'Sin departamento' : 'Selecciona un municipio'}</option>
        {municipios.map((municipio) => (
          <option key={municipio} value={municipio}>
            {municipio}
          </option>
        ))}
        {!sinDepartamento && <option value={OPCION_OTRO}>Otro (no está en la lista)</option>}
      </select>

      {escribiendo && (
        <div className="mt-2">
          <label htmlFor={idTexto} className="sr-only">
            Nombre del municipio
          </label>
          <input
            id={idTexto}
            ref={campoRef}
            type="text"
            // Aparece porque se acaba de elegir "Otro": el siguiente paso natural es escribir.
            autoFocus={valor === ''}
            value={valor}
            placeholder="Escribe el nombre del municipio"
            onChange={(evento) => emitir(evento.target.value)}
            onBlur={() => {
              const limpio = normalizarEspacios(valor)
              if (limpio !== valor) emitir(limpio)
              onBlur?.()
            }}
            aria-invalid={errorVisible ? true : undefined}
            aria-describedby={`${idTexto}-descripcion`}
            className={`${CLASE_CONTROL} ${claseBordeCampo({ error: errorVisible, modificado })}`}
          />
          <div id={`${idTexto}-descripcion`} aria-live="polite">
            {sugerido ? (
              <p className="mt-1 text-sm text-amber-800">
                {sugerido} ya está en la lista.{' '}
                <button
                  type="button"
                  onClick={() => usarSugerido(sugerido)}
                  className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                >
                  Usar {sugerido}
                </button>
              </p>
            ) : errorVisible ? (
              <p className="mt-1 text-sm text-red-600">{errorVisible}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Solo si no aparece en la lista de {departamento}.
              </p>
            )}
          </div>
        </div>
      )}
    </Campo>
  )
}

function ordenarAlfabeticamente(municipios: readonly string[]): string[] {
  return [...municipios].sort((a, b) => a.localeCompare(b, 'es'))
}
