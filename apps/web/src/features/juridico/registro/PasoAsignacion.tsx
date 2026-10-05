import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  TIPOS_PROCESO_VINCULO_RECOMENDADO,
  hoyGT,
  type PersonalDto,
  type ProcesoVinculadoDto,
  type TipoProcesoJuridico,
} from '@akyuam/shared'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import type { CampoAsignable, FilaRegistro } from './registroReducer'

interface PasoAsignacionProps {
  filas: FilaRegistro[]
  abogadas: PersonalDto[]
  procuradoras: PersonalDto[]
  procesosVinculables: ProcesoVinculadoDto[]
  onAsignar: (tipo: TipoProcesoJuridico, campo: CampoAsignable, valor: string) => void
  onCopiarPrimero: () => void
  onQuitar: (tipo: TipoProcesoJuridico) => void
  onAgregarOtro: () => void
}

function SelectPersonal({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string
  valor: string
  opciones: PersonalDto[]
  onChange: (valor: string) => void
}) {
  return (
    <label className={CLASE_ETIQUETA}>
      <span>{etiqueta}</span>
      <select value={valor} onChange={(evento) => onChange(evento.target.value)} className={CLASE_CAMPO}>
        <option value="">Sin asignar</option>
        {opciones.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Paso 2: una tarjeta por proceso elegido. Nada es obligatorio salvo la fecha de inicio. */
export default function PasoAsignacion({
  filas,
  abogadas,
  procuradoras,
  procesosVinculables,
  onAsignar,
  onCopiarPrimero,
  onQuitar,
  onAgregarOtro,
}: PasoAsignacionProps) {
  const hoy = hoyGT()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Asigne quién lleva cada proceso. Puede dejarlo sin asignar y completarlo después.
        </p>
        {filas.length > 1 && (
          <button type="button" onClick={onCopiarPrimero} className="text-sm font-medium text-brand-700 hover:underline">
            Usar la asignación del primero en todos
          </button>
        )}
      </div>

      {filas.map((fila, indice) => {
        const recomendado = TIPOS_PROCESO_VINCULO_RECOMENDADO.includes(fila.tipo)
        const nombre = ETIQUETAS_TIPO_PROCESO_JURIDICO[fila.tipo]
        return (
          <section key={fila.tipo} aria-label={nombre} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">
                <span className="mr-2 text-gray-400 tabular-nums">{indice + 1}.</span>
                {nombre}
              </h3>
              <button
                type="button"
                onClick={() => onQuitar(fila.tipo)}
                aria-label={`Quitar ${nombre}`}
                className="text-xs font-medium text-gray-500 hover:text-red-700 hover:underline"
              >
                Quitar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectPersonal
                etiqueta="Abogada"
                valor={fila.abogadaId}
                opciones={abogadas}
                onChange={(valor) => onAsignar(fila.tipo, 'abogadaId', valor)}
              />
              <SelectPersonal
                etiqueta="Procuradora"
                valor={fila.procuradoraId}
                opciones={procuradoras}
                onChange={(valor) => onAsignar(fila.tipo, 'procuradoraId', valor)}
              />
              <label className={CLASE_ETIQUETA}>
                <span>Fecha de inicio</span>
                <input
                  type="date"
                  value={fila.fechaInicio}
                  max={hoy}
                  onChange={(evento) => onAsignar(fila.tipo, 'fechaInicio', evento.target.value)}
                  className={CLASE_CAMPO}
                />
              </label>
              {(recomendado || procesosVinculables.length > 0) && (
                <label className={`${CLASE_ETIQUETA} sm:col-span-3`}>
                  <span>Proceso de origen (opcional)</span>
                  <select
                    value={fila.procesoOrigenId}
                    onChange={(evento) => onAsignar(fila.tipo, 'procesoOrigenId', evento.target.value)}
                    disabled={procesosVinculables.length === 0}
                    className={CLASE_CAMPO}
                  >
                    <option value="">
                      {procesosVinculables.length === 0 ? 'La usuaria no tiene procesos anteriores' : 'Sin vínculo'}
                    </option>
                    {procesosVinculables.map((proceso) => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.codigo} · {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}
                      </option>
                    ))}
                  </select>
                  {recomendado && (
                    <span className="block font-normal text-[#8a5a14]">
                      Recomendado: este tipo suele derivar de una sentencia anterior.
                    </span>
                  )}
                </label>
              )}
            </div>
          </section>
        )
      })}

      <button type="button" onClick={onAgregarOtro} className="text-sm font-medium text-brand-700 hover:underline">
        + Agregar otro tipo de proceso
      </button>
    </div>
  )
}
