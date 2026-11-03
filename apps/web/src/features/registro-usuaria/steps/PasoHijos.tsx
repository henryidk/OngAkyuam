import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form'
import {
  EDAD_MAXIMA_NINOS,
  edadEnAniosGT,
  formatFechaGT,
  type HijoConocido,
  type RegistroUsuariaNuevaFormValues,
} from '@akyuam/shared'
import TarjetaNino from '../components/TarjetaNino'

interface PasoHijosProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
  ninosFieldArray: UseFieldArrayReturn<RegistroUsuariaNuevaFormValues, 'datosCaso.ninos'>
  /** Hijos/as que la usuaria ya trajo en casos anteriores (vacío si es una usuaria nueva). */
  hijosConocidos?: HijoConocido[]
}

/** Solo se monta en casos Interna — `construirPasos` omite este paso para Externa. */
export default function PasoHijos({ form, ninosFieldArray, hijosConocidos = [] }: PasoHijosProps) {
  const {
    watch,
    formState: { errors },
  } = form
  const { fields, append, remove, replace } = ninosFieldArray
  // `fields` guarda los valores con los que se agregó cada fila; `watch` da los actuales.
  const ninos = watch('datosCaso.ninos') ?? []
  const elegidos = new Set(ninos.flatMap((nino) => (nino.hijoId ? [nino.hijoId] : [])))
  const [vieneConHijos, setVieneConHijos] = useState(fields.length > 0)
  const [indiceExpandido, setIndiceExpandido] = useState<number | null>(null)

  function agregarNino() {
    append({ nombres: '', apellidos: '', fechaNacimiento: '', genero: 'M' })
    setIndiceExpandido(fields.length)
  }

  /** Marcar o desmarcar a un hijo/a ya registrado: se envía su `hijoId` con sus datos actuales. */
  function alternarConocido(hijo: HijoConocido) {
    const indice = ninos.findIndex((nino) => nino.hijoId === hijo.hijoId)
    if (indice >= 0) {
      quitarNino(indice)
    } else {
      append(hijo, { shouldFocus: false })
    }
  }

  function quitarNino(indice: number) {
    remove(indice)
    setIndiceExpandido((actual) => (actual === indice ? null : actual))
  }

  function responder(viene: boolean) {
    setVieneConHijos(viene)
    if (viene && fields.length === 0 && hijosConocidos.length === 0) {
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
          {hijosConocidos.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-gray-800">
                Hijas e hijos ya registrados — marque quiénes vienen en este caso
              </legend>
              {hijosConocidos.map((hijo) => {
                const edad = edadEnAniosGT(hijo.fechaNacimiento)
                const fueraDeEdad = edad >= EDAD_MAXIMA_NINOS
                const marcado = elegidos.has(hijo.hijoId)
                return (
                  <label
                    key={hijo.hijoId}
                    className={`flex items-center gap-3 rounded border px-3 py-2 ${
                      marcado ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white'
                    } ${fueraDeEdad && !marcado ? 'opacity-60' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={fueraDeEdad && !marcado}
                      onChange={() => alternarConocido(hijo)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                      {hijo.nombres} {hijo.apellidos}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {fueraDeEdad
                        ? `Ya tiene ${edad} años`
                        : `Nacimiento ${formatFechaGT(hijo.fechaNacimiento)}`}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}

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
            {hijosConocidos.length > 0 ? 'Agregar otra hija u otro hijo' : 'Agregar hija o hijo'}
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
