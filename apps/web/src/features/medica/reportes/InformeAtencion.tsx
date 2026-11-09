import { useCallback, useState } from 'react'
import {
  ETIQUETAS_FILA_INFORME_ATENCION_MEDICA,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_RANGO_EDAD_INFORME_MEDICA,
  formatFechaGT,
  GRUPOS_ETNICOS,
  RANGOS_EDAD_INFORME_MEDICA,
  type CifrasInformeAtencionMedica,
  type InformeAtencionMedicaQuery,
} from '@akyuam/shared'
import { Download } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarInformeAtencion, obtenerInformeAtencion } from '../api/medica.api'
import { CLASE_TARJETA } from '../compartido/estilos'

const CLASE_TH = 'border border-borde px-2 py-1.5 text-center text-[11.5px] font-semibold text-texto-cuerpo'
const CLASE_TD = 'border border-borde px-2 py-1.5 text-center tabular-nums text-texto'

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
 * por sexo, pertenencia étnica y edad. El periodo lo elige la pantalla de Reportes (no la URL).
 */
export default function InformeAtencion({ periodo }: { periodo: InformeAtencionMedicaQuery }) {
  const { mostrar } = useToast()
  const [descargando, setDescargando] = useState(false)

  const cargar = useCallback(() => obtenerInformeAtencion(periodo), [periodo])
  const { datos: informe, error, recargar } = useRecurso(cargar)

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
    <section aria-labelledby="titulo-informe" className={`${CLASE_TARJETA} flex flex-col gap-4 px-5 py-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="titulo-informe" className="text-base font-semibold text-texto">
            Informe de atención
          </h2>
          <p className="text-[13px] text-texto-suave">
            Formato de la ONG · del {formatFechaGT(periodo.desde)} al {formatFechaGT(periodo.hasta)}
          </p>
        </div>
        <Button variante="primary" tamano="md" cargando={descargando} disabled={!informe} onClick={() => void descargar()}>
          {!descargando && <Download aria-hidden="true" className="h-4 w-4" />}
          {descargando ? 'Generando…' : 'Descargar informe (Excel)'}
        </Button>
      </div>

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="el informe" onReintentar={() => void recargar()} />
      ) : !informe ? (
        <Esqueleto filas={4} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead className="bg-superficie">
              <tr>
                <th rowSpan={2} scope="col" className={`${CLASE_TH} sticky left-0 z-10 bg-superficie text-left`}>
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
                  <th scope="row" className="sticky left-0 z-10 border border-borde bg-white px-2.5 py-2 text-left font-normal text-texto">
                    {ETIQUETAS_FILA_INFORME_ATENCION_MEDICA[fila.clave]}
                  </th>
                  {celdas(fila).map((valor, indice) => (
                    <td key={indice} className={CLASE_TD}>
                      {valor}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-superficie font-semibold">
                <th scope="row" className="sticky left-0 z-10 border border-borde bg-superficie px-2.5 py-2 text-left text-texto">
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
      <ul className="flex max-w-[75ch] list-disc flex-col gap-0.5 pl-4 text-xs text-texto-suave marker:text-texto-sutil">
        <li>Etnia según el registro de Trabajo Social; hijos e hijas con la de su madre.</li>
        <li>Edad al día de la primera consulta del periodo.</li>
        <li>Una persona puede estar en más de un renglón (por ejemplo, nuevo ingreso y albergada): los totales suman renglones, como el formato.</li>
      </ul>
    </section>
  )
}
