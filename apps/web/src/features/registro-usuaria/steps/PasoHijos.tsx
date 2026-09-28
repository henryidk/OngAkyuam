import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form'
import { EDAD_MAXIMA_NINOS, type RegistroUsuariaNuevaFormValues } from '@akyuam/shared'
import TarjetaNino from '../components/TarjetaNino'

interface PasoHijosProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
  ninosFieldArray: UseFieldArrayReturn<RegistroUsuariaNuevaFormValues, 'datosCaso.ninos'>
}

/** Solo se monta en casos Interna — `construirPasos` omite este paso para Externa. */
export default function PasoHijos({ form, ninosFieldArray }: PasoHijosProps) {
  const {
    formState: { errors },
  } = form
  const { fields, append, remove, replace } = ninosFieldArray
  const [vieneConHijos, setVieneConHijos] = useState(fields.length > 0)
  const [indiceExpandido, setIndiceExpandido] = useState<number | null>(null)

  function agregarNino() {
    append({ nombres: '', apellidos: '', fechaNacimiento: '', genero: 'M' })
    setIndiceExpandido(fields.length)
  }

  function quitarNino(indice: number) {
    remove(indice)
    setIndiceExpandido((actual) => (actual === indice ? null : actual))
  }

  function responder(viene: boolean) {
    setVieneConHijos(viene)
    if (viene && fields.length === 0) {
      agregarNino()
    } else if (!viene) {
      replace([])
      setIndiceExpandido(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-800">¿Ingresa al albergue con hijas o hijos?</p>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300" role="group">
          {[
            { valor: true, etiqueta: 'Sí' },
            { valor: false, etiqueta: 'No' },
          ].map((opcion) => (
            <button
              key={opcion.etiqueta}
              type="button"
              aria-pressed={vieneConHijos === opcion.valor}
              onClick={() => responder(opcion.valor)}
              className={`px-4 py-1.5 text-sm font-medium ${
                vieneConHijos === opcion.valor ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {vieneConHijos && (
        <>
          <div className="space-y-2">
            {fields.map((field, indice) => (
              <TarjetaNino
                key={field.id}
                form={form}
                indice={indice}
                expandido={indiceExpandido === indice}
                onExpandir={() => setIndiceExpandido(indice)}
                onColapsar={() => setIndiceExpandido(null)}
                onEliminar={() => quitarNino(indice)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={agregarNino}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Plus size={15} strokeWidth={2.25} />
            Agregar hija o hijo
          </button>
        </>
      )}

      {errors.datosCaso?.ninos?.message && <p className="text-sm text-red-600">{errors.datosCaso.ninos.message}</p>}

      <p className="text-xs text-gray-500">
        Solo menores de {EDAD_MAXIMA_NINOS} años. La fecha, ubicación, tipología del delito y grupo étnico del caso se
        comparten automáticamente — aquí solo se pide el dato propio de cada niña o niño.
      </p>
    </div>
  )
}
