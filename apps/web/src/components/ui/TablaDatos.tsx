import type { ReactNode } from 'react'
import { Esqueleto } from './EstadosVista'
import Paginacion from './Paginacion'

export interface ColumnaTabla<T> {
  clave: string
  /** Texto del encabezado; en teléfono también rotula el dato dentro de la tarjeta. */
  encabezado: string
  celda: (fila: T) => ReactNode
  /**
   * `titulo`: la celda que encabeza la tarjeta en teléfono (el nombre). `acciones`: botones, al pie
   * de la tarjeta y con el encabezado solo para lectores de pantalla.
   */
  rol?: 'titulo' | 'acciones'
  /** Clases extra de la celda (alineación, `whitespace-nowrap`, ancho). */
  className?: string
}

export interface PaginacionTabla {
  pagina: number
  porPagina: number
  /** Filas que cumplen el filtro en el servidor, no solo las de esta página. */
  total: number
  /** Total que se puede recorrer con páginas, si el servidor pone un tope de página. */
  totalNavegable?: number
  onCambiar: (pagina: number) => void
}

interface TablaDatosProps<T> {
  /** Nombre de la tabla para lectores de pantalla ("Pacientes sin próxima consulta"). */
  titulo: string
  columnas: ColumnaTabla<T>[]
  /** null mientras carga: se ve un esqueleto, no "Cargando…". */
  filas: T[] | null
  claveFila: (fila: T) => string
  /** Qué decir (y qué hacer) cuando no hay filas. */
  vacio: ReactNode
  paginacion?: PaginacionTabla
}

const CELDA = 'px-4 py-2.5 max-md:px-0 max-md:py-0'

/**
 * Tabla de datos de las listas que crecen: `<table>` real con encabezado fijo al bajar, esqueleto
 * mientras carga, estado vacío, "Mostrando 1–20 de N" y páginas numeradas (se puede volver a la
 * 3, cosa que "Cargar más" no permite). Por debajo de `md` cada fila se apila como tarjeta, con el
 * nombre de cada columna junto a su dato: sin desplazamiento horizontal en el teléfono.
 */
export default function TablaDatos<T>({ titulo, columnas, filas, claveFila, vacio, paginacion }: TablaDatosProps<T>) {
  const desde = paginacion && filas ? (paginacion.pagina - 1) * paginacion.porPagina + 1 : 0
  const hasta = filas ? desde + filas.length - 1 : 0

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-lg border border-borde bg-white max-md:border-0 max-md:bg-transparent">
        {!filas ? (
          <div className="p-4 max-md:rounded-lg max-md:border max-md:border-borde max-md:bg-white">
            <Esqueleto filas={5} />
          </div>
        ) : filas.length === 0 ? (
          <div className="p-9 text-center text-sm text-texto-suave max-md:rounded-lg max-md:border max-md:border-borde max-md:bg-white">
            {vacio}
          </div>
        ) : (
          <table className="w-full text-left text-[13.5px] text-texto max-md:block">
            <caption className="sr-only">{titulo}</caption>
            <thead className="max-md:sr-only">
              <tr>
                {columnas.map((columna) => (
                  <th
                    key={columna.clave}
                    scope="col"
                    className="sticky top-0 z-[1] bg-superficie px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-texto-suave first:rounded-tl-lg last:rounded-tr-lg"
                  >
                    {columna.rol === 'acciones' ? <span className="sr-only">{columna.encabezado}</span> : columna.encabezado}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="max-md:flex max-md:flex-col max-md:gap-2">
              {filas.map((fila) => (
                <tr
                  key={claveFila(fila)}
                  className="border-t border-borde-suave align-middle max-md:flex max-md:flex-col max-md:gap-1.5 max-md:rounded-lg max-md:border max-md:border-borde max-md:bg-white max-md:p-3"
                >
                  {columnas.map((columna) => (
                    <td
                      key={columna.clave}
                      className={`${CELDA} ${columna.className ?? ''} ${
                        columna.rol === 'titulo'
                          ? 'max-md:order-first'
                          : columna.rol === 'acciones'
                            ? 'max-md:order-last max-md:pt-1'
                            : 'max-md:flex max-md:items-baseline max-md:gap-2'
                      }`}
                    >
                      {!columna.rol && (
                        <span className="hidden w-24 flex-none text-xs text-texto-suave max-md:inline">
                          {columna.encabezado}
                        </span>
                      )}
                      {columna.celda(fila)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {paginacion && filas && paginacion.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] tabular-nums text-texto-suave">
            {filas.length > 0 ? `Mostrando ${desde}–${hasta} de ${paginacion.total}` : `${paginacion.total} en total`}
          </p>
          <Paginacion
            etiqueta={`Páginas de ${titulo.toLowerCase()}`}
            pagina={paginacion.pagina}
            pageSize={paginacion.porPagina}
            total={paginacion.totalNavegable ?? paginacion.total}
            onCambiar={paginacion.onCambiar}
          />
        </div>
      )}
    </div>
  )
}
