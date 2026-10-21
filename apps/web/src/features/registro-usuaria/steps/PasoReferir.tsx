import { Check } from 'lucide-react'
import { AREAS_ATENCION, ETIQUETAS_AREA_ATENCION, MOTIVO_REFERIDO_MAX, type AreaAtencion } from '@akyuam/shared'
import Switch from '../../../components/ui/Switch'
import type { UseReferirAreas } from '../hooks/useReferirAreas'

const DESCRIPCION_AREA: Record<AreaAtencion, string> = {
  JURIDICO: 'Acompañamiento legal y procesos',
  PSICOLOGIA: 'Atención y seguimiento psicológico',
  MEDICA: 'Consulta y atención médica',
}

const CLASE_CAMPO =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

interface PasoReferirProps {
  referir: UseReferirAreas
}

/** Tarjetas seleccionables: al marcar un área se despliega su motivo y qué podrá ver. */
export default function PasoReferir({ referir }: PasoReferirProps) {
  const { referencias, actualizar, enviando } = referir

  return (
    <div className="flex flex-col gap-3">
      {AREAS_ATENCION.map((area) => {
        const referencia = referencias[area]
        const esJuridico = area === 'JURIDICO'
        const etiqueta = ETIQUETAS_AREA_ATENCION[area]
        const abierta = referencia.seleccionada || referencia.referida

        return (
          <div
            key={area}
            className={`overflow-hidden rounded-lg border-2 transition-colors ${
              referencia.referida
                ? 'border-green-200 bg-green-50/40'
                : referencia.seleccionada
                  ? 'border-brand-600'
                  : 'border-gray-200'
            }`}
          >
            <label
              className={`flex items-center gap-3 px-4 py-3.5 ${referencia.referida ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={abierta}
                disabled={referencia.referida || enviando}
                onChange={(event) => actualizar(area, { seleccionada: event.target.checked })}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">Área {etiqueta}</span>
                <span className="block text-xs text-gray-500">{DESCRIPCION_AREA[area]}</span>
              </span>
              {referencia.referida && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  Referida
                </span>
              )}
            </label>

            {abierta && !referencia.referida && (
              <div className="space-y-3 border-t border-gray-100 px-4 py-3.5">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">Motivo de la referencia</span>
                  <textarea
                    rows={2}
                    maxLength={MOTIVO_REFERIDO_MAX}
                    value={referencia.motivo}
                    disabled={enviando}
                    onChange={(event) => actualizar(area, { motivo: event.target.value })}
                    placeholder={`Qué necesita la usuaria del área ${etiqueta.toLowerCase()}`}
                    className={CLASE_CAMPO}
                  />
                </label>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Agresor, tipología y observaciones</p>
                    <p className="text-xs text-gray-500">
                      {esJuridico
                        ? 'Jurídico tiene acceso completo por normativa.'
                        : 'Los datos de la usuaria e hijas/hijos se comparten siempre.'}
                    </p>
                  </div>
                  <Switch
                    encendido={esJuridico || referencia.datosCaso}
                    onChange={(valor) => actualizar(area, { datosCaso: valor })}
                    ariaLabel={`Compartir agresor, tipología y observaciones con ${etiqueta}`}
                    bloqueado={esJuridico}
                    deshabilitado={enviando}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      <p className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-500">
        Cada área recibe a la usuaria en su bandeja y decide quién la atiende. Los documentos se comparten en el
        siguiente paso; lo que elijas aquí puedes cambiarlo después desde Accesos y referencias.
      </p>

      {referir.error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {referir.error}
        </p>
      )}
    </div>
  )
}
