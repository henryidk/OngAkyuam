import {
  CATEGORIA_POR_TIPO_PROCESO,
  CATEGORIAS_PROCESO_JURIDICO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  MAX_PROCESOS_POR_LOTE,
  TIPOS_PROCESO_JURIDICO,
  type ProcesoActivoPorTipo,
  type TipoProcesoJuridico,
} from '@akyuam/shared'

interface PasoSeleccionProps {
  seleccionados: TipoProcesoJuridico[]
  sugeridos: TipoProcesoJuridico[]
  activosPorTipo: ProcesoActivoPorTipo[]
  onAlternar: (tipo: TipoProcesoJuridico) => void
}

const CLASE_AVISO = 'rounded-full px-2 py-0.5 text-[11px] font-medium'

/** Paso 1: solo elegir. Sin campos de texto, para que marcar varios procesos sea rápido. */
export default function PasoSeleccion({ seleccionados, sugeridos, activosPorTipo, onAlternar }: PasoSeleccionProps) {
  const enElLimite = seleccionados.length >= MAX_PROCESOS_POR_LOTE

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Marque todos los procesos que se iniciarán para esta usuaria. Cada uno queda con su propio avance, bitácora y
        documentos.
      </p>
      {CATEGORIAS_PROCESO_JURIDICO.map((categoria) => {
        const tipos = TIPOS_PROCESO_JURIDICO.filter((tipo) => CATEGORIA_POR_TIPO_PROCESO[tipo] === categoria)
        if (tipos.length === 0) return null
        return (
          <fieldset key={categoria}>
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {ETIQUETAS_CATEGORIA_PROCESO[categoria]}
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {tipos.map((tipo) => {
                const marcado = seleccionados.includes(tipo)
                const activo = activosPorTipo.find((proceso) => proceso.tipo === tipo)
                return (
                  <label
                    key={tipo}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      marcado ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    } ${!marcado && enElLimite ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={!marcado && enElLimite}
                      onChange={() => onAlternar(tipo)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo]}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5 empty:hidden">
                        {sugeridos.includes(tipo) && (
                          <span className={`${CLASE_AVISO} bg-brand-100 text-brand-700`}>Sugerido por TS</span>
                        )}
                        {activo && (
                          <span className={`${CLASE_AVISO} bg-amber-100 text-[#8a5a14]`}>
                            Ya tiene uno activo · {activo.codigo}
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
      {enElLimite && (
        <p className="text-xs text-gray-500">Se pueden registrar hasta {MAX_PROCESOS_POR_LOTE} procesos a la vez.</p>
      )}
    </div>
  )
}
