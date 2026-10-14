import { useState } from 'react'
import {
  DESCRIPCIONES_MOTIVO_ALTA_MEDICA,
  ETIQUETAS_MOTIVO_ALTA_MEDICA,
  MOTIVOS_ALTA_MEDICA,
  NOTA_ALTA_MEDICA_MAX,
  altaAtencionMedicaSchema,
  type MotivoAltaMedica,
} from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { darDeAlta } from '../api/medica.api'
import { CLASE_CAMPO } from '../compartido/estilos'
import ModalMedica from '../compartido/ModalMedica'

interface ModalAltaProps {
  atencion: { id: string; codigo: string; version: number }
  onCerrar: () => void
  /** Recibe el motivo para el aviso y cuántas citas futuras se cancelaron. */
  onListo: (motivo: MotivoAltaMedica, citasCanceladas: number) => void
}

/** Dar de alta: cierra la atención activa y cancela sus consultas futuras. La historia se conserva. */
export default function ModalAlta({ atencion, onCerrar, onListo }: ModalAltaProps) {
  const [motivo, setMotivo] = useState<MotivoAltaMedica>('ALTA_MEDICA')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notaObligatoria = motivo === 'OTRO'
  const valido = !notaObligatoria || nota.trim() !== ''

  async function guardar() {
    setError(null)
    const datos = { motivo, nota, version: atencion.version }
    const validacion = altaAtencionMedicaSchema.safeParse(datos)
    if (!validacion.success) return setError(validacion.error.issues[0]?.message ?? 'Revisa el formulario.')
    setGuardando(true)
    try {
      const { citasCanceladas } = await darDeAlta(atencion.id, datos)
      onListo(motivo, citasCanceladas)
    } catch (err) {
      setError(extraerMensajeError(err))
      setGuardando(false)
    }
  }

  return (
    <ModalMedica
      titulo={`Dar de alta · ${atencion.codigo}`}
      subtitulo="La atención se cierra y se cancelan sus consultas futuras. La historia clínica se conserva; si regresa, se abre una atención nueva."
      ancho={480}
      ocupado={guardando}
      onCerrar={onCerrar}
      pie={
        <>
          <button
            type="button"
            disabled={guardando}
            onClick={onCerrar}
            className="rounded-md border border-[#d5dadf] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || !valido}
            onClick={() => void guardar()}
            className="rounded-md bg-[#7346a5] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#5b3985] disabled:bg-[#b9a6d1]"
          >
            {guardando ? 'Guardando…' : 'Dar de alta'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div role="radiogroup" aria-label="Motivo del alta" className="flex flex-col gap-1.5">
          {MOTIVOS_ALTA_MEDICA.map((opcion) => {
            const elegido = opcion === motivo
            return (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={elegido}
                disabled={guardando}
                onClick={() => setMotivo(opcion)}
                className={`flex items-start gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 text-left text-[#1c2430] ${
                  elegido ? 'border-[#7346a5] bg-[#f7f3fc]' : 'border-[#e3e6ea] bg-white hover:border-[#c7a8e5]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] ${
                    elegido ? 'border-[#7346a5]' : 'border-[#c4cad1]'
                  }`}
                >
                  {elegido && <span className="h-2 w-2 rounded-full bg-[#7346a5]" />}
                </span>
                <span className="flex flex-col gap-px">
                  <span className="text-[13.5px] font-semibold">{ETIQUETAS_MOTIVO_ALTA_MEDICA[opcion]}</span>
                  <span className="text-xs text-[#5b6573]">{DESCRIPCIONES_MOTIVO_ALTA_MEDICA[opcion]}</span>
                </span>
              </button>
            )
          })}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[#1c2430]">
            Nota de cierre{' '}
            <span className="font-normal text-[#5b6573]">{notaObligatoria ? '(obligatoria)' : '(opcional)'}</span>
          </span>
          <textarea
            rows={2}
            maxLength={NOTA_ALTA_MEDICA_MAX}
            value={nota}
            disabled={guardando}
            onChange={(evento) => setNota(evento.target.value)}
            placeholder="Ej.: síntomas resueltos, indicaciones finales"
            className={`${CLASE_CAMPO} resize-y`}
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-[#9b2c20]">
            {error}
          </p>
        )}
      </div>
    </ModalMedica>
  )
}
