import type { UseFormRegisterReturn } from 'react-hook-form'
import type { TipoRegistro } from '@akyuam/shared'

interface TarjetasTipoRegistroProps {
  registro: UseFormRegisterReturn
  error?: string
}

const OPCIONES: { valor: TipoRegistro; titulo: string; descripcion: string }[] = [
  { valor: 'EXTERNA', titulo: 'Externa', descripcion: 'Recibe atención y regresa a su hogar.' },
  {
    valor: 'INTERNA',
    titulo: 'Interna · solicita albergue',
    descripcion: 'Ingresa al albergue, con hijas/hijos menores de 12 años.',
  },
]

/** Externa o Interna como dos tarjetas grandes; por dentro son radios nativos registrados en RHF. */
export default function TarjetasTipoRegistro({ registro, error }: TarjetasTipoRegistroProps) {
  return (
    <fieldset>
      <legend className="sr-only">Tipo de registro</legend>
      <div role="radiogroup" aria-label="Tipo de registro" className="grid gap-3 sm:grid-cols-2">
        {OPCIONES.map((opcion) => (
          <label
            key={opcion.valor}
            className="cursor-pointer rounded-[10px] border-2 border-gray-200 p-4 text-left transition-colors has-checked:border-brand-600 has-checked:bg-brand-50 has-focus-visible:ring-2 has-focus-visible:ring-brand-500"
          >
            <input type="radio" value={opcion.valor} className="sr-only" {...registro} />
            <span className="block text-sm font-semibold text-gray-900">{opcion.titulo}</span>
            <span className="mt-1 block text-xs text-gray-500">{opcion.descripcion}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
