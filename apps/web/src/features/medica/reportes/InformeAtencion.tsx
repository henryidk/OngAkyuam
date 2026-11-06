import { useCallback, useState } from 'react'
import {
  ETIQUETAS_FILA_INFORME_ATENCION_MEDICA,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_RANGO_EDAD_INFORME_MEDICA,
  formatFechaGT,
  GRUPOS_ETNICOS,
  hoyGT,
  informeAtencionMedicaQuerySchema,
  RANGOS_EDAD_INFORME_MEDICA,
  type CifrasInformeAtencionMedica,
  type InformeAtencionMedicaQuery,
} from '@akyuam/shared'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarInformeAtencion, obtenerInformeAtencion } from '../api/medica.api'
import { CLASE_CAMPO, CLASE_TARJETA } from '../compartido/estilos'

const CLASE_TH = 'border border-[#e3e6ea] px-2 py-1.5 text-center text-[11.5px] font-semibold text-[#374151]'
const CLASE_TD = 'border border-[#e3e6ea] px-2 py-1.5 text-center tabular-nums text-[#1c2430]'

function celdas(cifras: CifrasInformeAtencionMedica) {
  return [
    cifras.mujer,
    cifras.hombre,
    ...GRUPOS_ETNICOS.map((grupo) => cifras.etnia[grupo]),
    ...RANGOS_EDAD_INFORME_MEDICA.map((rango) => cifras.edad[rango]),
    cifras.total,
  ]
}

/**
 * Informe de atención con el formato que entregó la ONG: renglones por tipo de atención y columnas
 * por sexo, pertenencia étnica y edad. El periodo vive en el estado de la pantalla, no en la URL.
 */
export default function InformeAtencion() {
  const { mostrar } = useToast()
  const [hoy] = useState(hoyGT)
  // Por defecto, el mes en curso hasta hoy.
  const [campos, setCampos] = useState<InformeAtencionMedicaQuery>(() => ({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy }))
  const [periodo, setPeriodo] = useState(campos)
  const [descargando, setDescargando] = useState(false)

  const valido = informeAtencionMedicaQuerySchema.safeParse(campos)
  const cargar = useCallback(() => obtenerInformeAtencion(periodo), [periodo])
  const { datos: informe, error, recargar } = useRecurso(cargar)

  function cambiar(cambios: Partial<InformeAtencionMedicaQuery>) {
    const nuevos = { ...campos, ...cambios }
    setCampos(nuevos)
    // Solo se pide con un rango completo y en orden; mientras tanto se sigue viendo el anterior.
    if (informeAtencionMedicaQuerySchema.safeParse(nuevos).success) setPeriodo(nuevos)
  }

  async function descargar() {
    setDescargando(true)
    try {
      guardarArchivo(await descargarInformeAtencion(periodo), `medicina-atencion_${periodo.desde}_${periodo.hasta}.xlsx`)
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      mostrar('No se pudo generar el Excel. Intenta de nuevo.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-3.5 px-5 py-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-px">
          <h2 className="text-base font-semibold text-[#1c2430]">Informe de atención</h2>
          <p className="text-xs text-[#5b6573]">
            Formato de la ONG · del {formatFechaGT(periodo.desde)} al {formatFechaGT(periodo.hasta)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#5b6573]">
            Desde
            <input
              type="date"
              value={campos.desde}
              max={hoy}
              onChange={(evento) => cambiar({ desde: evento.target.value })}
              className={`${CLASE_CAMPO} w-[150px] py-1.5`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#5b6573]">
            Hasta
            <input
              type="date"
              value={campos.hasta}
              max={hoy}
              onChange={(evento) => cambiar({ hasta: evento.target.value })}
              className={`${CLASE_CAMPO} w-[150px] py-1.5`}
            />
          </label>
          <button
            type="button"
            disabled={descargando || !informe}
            onClick={() => void descargar()}
            className="whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa] disabled:opacity-60"
          >
            {descargando ? 'Generando…' : 'Descargar Excel'}
          </button>
        </div>
      </div>
      {!valido.success && (
        <p role="alert" className="text-[13px] text-[#9b2c20]">
          {valido.error.issues[0]?.message ?? 'Revisa las fechas.'}
        </p>
      )}

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el informe" onReintentar={() => void recargar()} />
      ) : !informe ? (
        <Esqueleto filas={4} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead className="bg-[#f8f9fa]">
              <tr>
                <th rowSpan={2} scope="col" className={`${CLASE_TH} text-left`}>
                  Atención
                </th>
                <th colSpan={2} scope="colgroup" className={CLASE_TH}>
                  Total
                </th>
                <th colSpan={GRUPOS_ETNICOS.length} scope="colgroup" className={CLASE_TH}>
                  Pertenencia étnica
                </th>
                <th colSpan={RANGOS_EDAD_INFORME_MEDICA.length} scope="colgroup" className={CLASE_TH}>
                  Datos etarios (años)
                </th>
                <th rowSpan={2} scope="col" className={CLASE_TH}>
                  TOTAL
                </th>
              </tr>
              <tr>
                <th scope="col" className={CLASE_TH}>
                  Mujer
                </th>
                <th scope="col" className={CLASE_TH}>
                  Hombre
                </th>
                {GRUPOS_ETNICOS.map((grupo) => (
                  <th key={grupo} scope="col" className={CLASE_TH}>
                    {ETIQUETAS_GRUPO_ETNICO[grupo]}
                  </th>
                ))}
                {RANGOS_EDAD_INFORME_MEDICA.map((rango) => (
                  <th key={rango} scope="col" className={`${CLASE_TH} whitespace-nowrap`}>
                    {ETIQUETAS_RANGO_EDAD_INFORME_MEDICA[rango]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {informe.filas.map((fila) => (
                <tr key={fila.clave}>
                  <th scope="row" className="border border-[#e3e6ea] px-2.5 py-1.5 text-left font-normal text-[#1c2430]">
                    {ETIQUETAS_FILA_INFORME_ATENCION_MEDICA[fila.clave]}
                  </th>
                  {celdas(fila).map((valor, indice) => (
                    <td key={indice} className={CLASE_TD}>
                      {valor}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-[#f8f9fa] font-semibold">
                <th scope="row" className="border border-[#e3e6ea] px-2.5 py-1.5 text-left text-[#1c2430]">
                  TOTALES
                </th>
                {celdas(informe.totales).map((valor, indice) => (
                  <td key={indice} className={CLASE_TD}>
                    {valor}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[#5b6573]">
        Etnia según el registro de Trabajo Social (hijos e hijas con la de su madre). Edad al día de la primera consulta del
        periodo. Una persona puede aparecer en más de un renglón (por ejemplo, de nuevo ingreso y albergada), así que los
        totales suman renglones, como en el formato.
      </p>
    </section>
  )
}
