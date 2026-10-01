import { ETIQUETAS_AREA_ATENCION, type AreaAtencion, type ColumnaMatrizAccesos, type MatrizAccesos as Matriz } from '@akyuam/shared'
import Switch from '../../../components/ui/Switch'
import type { ClaveFilaAcceso } from './matrizAccesos'

interface MatrizAccesosProps {
  matriz: Matriz
  onCambiar: (clave: ClaveFilaAcceso, area: AreaAtencion, visible: boolean) => void
}

const CLASE_GRILLA = 'grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(110px,1fr))] items-center'

function subtituloColumna(columna: ColumnaMatrizAccesos) {
  if (!columna.restringible) return 'Acceso completo'
  return columna.referida ? 'Referida' : 'No referida'
}

/** Datos de la usuaria: siempre los ve Jurídico, las demás al ser referidas. */
function textoDatosUsuaria(columna: ColumnaMatrizAccesos) {
  if (!columna.restringible) return 'Siempre'
  return columna.referida ? 'Incluido al referir' : '—'
}

function etiquetaCelda(visible: boolean, bloqueado: boolean, deshabilitado: boolean, referida: boolean) {
  if (!referida) return 'No referida'
  if (deshabilitado) return 'No subido'
  if (bloqueado) return 'Siempre'
  return visible ? 'Visible' : 'Privado'
}

/** Matriz de §12.5 "Accesos y referencias": una fila por dato/documento, una columna por área. */
export default function MatrizAccesos({ matriz, onCambiar }: MatrizAccesosProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className={`${CLASE_GRILLA} border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500`}>
          <span>Información</span>
          {matriz.columnas.map((columna) => (
            <span key={columna.area} className="text-center">
              {ETIQUETAS_AREA_ATENCION[columna.area]}
              <span className="block font-normal normal-case tracking-normal text-gray-500">{subtituloColumna(columna)}</span>
            </span>
          ))}
        </div>

        <div className={`${CLASE_GRILLA} border-t border-gray-100 px-5 py-3`}>
          <div>
            <p className="text-sm font-medium text-gray-800">Datos de la usuaria e hijas/hijos</p>
            <p className="text-xs text-gray-500">Identidad, contacto y beneficiarios</p>
          </div>
          {matriz.columnas.map((columna) => (
            <span key={columna.area} className="text-center text-xs text-gray-500">
              {textoDatosUsuaria(columna)}
            </span>
          ))}
        </div>

        {matriz.filas.map((fila) => (
          <div key={fila.clave} className={`${CLASE_GRILLA} border-t border-gray-100 px-5 py-3`}>
            <div>
              <p className="text-sm font-medium text-gray-800">{fila.etiqueta}</p>
              <p className="text-xs text-gray-500">{fila.descripcion}</p>
            </div>
            {matriz.columnas.map((columna) => {
              const celda = fila.celdas[columna.area]
              return (
                <Switch
                  key={columna.area}
                  encendido={celda.visible}
                  bloqueado={celda.bloqueado}
                  deshabilitado={celda.deshabilitado}
                  ariaLabel={`${fila.etiqueta} — ${ETIQUETAS_AREA_ATENCION[columna.area]}`}
                  etiqueta={etiquetaCelda(celda.visible, celda.bloqueado, celda.deshabilitado, columna.referida)}
                  onChange={(visible) => onCambiar(fila.clave, columna.area, visible)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
