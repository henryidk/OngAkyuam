import { Pencil, Trash2 } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { ETIQUETAS_GENERO, formatFechaGT, GENEROS, type RegistroUsuariaNuevaFormValues } from '@akyuam/shared'
import GrupoRadio from '../../../components/form/GrupoRadio'
import TextoInput from '../../../components/form/TextoInput'

interface TarjetaNinoProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
  indice: number
  expandido: boolean
  onExpandir: () => void
  onColapsar: () => void
  onEliminar: () => void
}

const opcionesGenero = GENEROS.map((genero) => ({ value: genero, label: ETIQUETAS_GENERO[genero] }))

export default function TarjetaNino({ form, indice, expandido, onExpandir, onColapsar, onEliminar }: TarjetaNinoProps) {
  const {
    register,
    getValues,
    formState: { errors },
  } = form
  const erroresNino = errors.datosCaso?.ninos?.[indice]
  const tieneErrores = Boolean(erroresNino)
  const nino = getValues(`datosCaso.ninos.${indice}`)
  const nombreCompleto = `${nino.nombres} ${nino.apellidos}`.trim()

  if (!expandido) {
    return (
      <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={onExpandir}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="truncate text-sm font-medium text-gray-800">
            {nombreCompleto || `Niña o niño ${indice + 1}`}
          </span>
          {nino.fechaNacimiento && (
            <span className="shrink-0 text-xs text-gray-500">Nacimiento {formatFechaGT(nino.fechaNacimiento)}</span>
          )}
          {tieneErrores && <span className="shrink-0 text-xs font-medium text-red-600">Datos incompletos</span>}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onExpandir}
            title="Editar"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onEliminar}
            title="Quitar"
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded border border-brand-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Niña o niño {indice + 1}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onEliminar} className="text-xs font-medium text-red-600 hover:underline">
            Quitar
          </button>
          <button
            type="button"
            onClick={onColapsar}
            className="rounded bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            Listo
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextoInput
          label="Nombres"
          registro={register(`datosCaso.ninos.${indice}.nombres`)}
          error={erroresNino?.nombres?.message}
        />
        <TextoInput
          label="Apellidos"
          registro={register(`datosCaso.ninos.${indice}.apellidos`)}
          error={erroresNino?.apellidos?.message}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextoInput
          label="Fecha de nacimiento"
          type="date"
          registro={register(`datosCaso.ninos.${indice}.fechaNacimiento`)}
          error={erroresNino?.fechaNacimiento?.message}
        />
        <GrupoRadio
          label="Género"
          opciones={opcionesGenero}
          registro={register(`datosCaso.ninos.${indice}.genero`)}
          error={erroresNino?.genero?.message}
        />
      </div>
    </div>
  )
}
