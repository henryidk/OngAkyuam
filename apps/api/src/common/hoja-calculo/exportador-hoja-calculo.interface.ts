export const EXPORTADOR_HOJA_CALCULO = Symbol('EXPORTADOR_HOJA_CALCULO');

/**
 * `fecha` recibe un "YYYY-MM-DD" (fecha de calendario) y se escribe como fecha real de Excel,
 * para que se pueda ordenar y filtrar; `texto` y `numero` se escriben tal cual.
 */
export type TipoColumnaHoja = 'texto' | 'numero' | 'fecha';

export interface ColumnaHoja {
  titulo: string;
  /** Ancho en caracteres. */
  ancho: number;
  tipo: TipoColumnaHoja;
  /**
   * Encabezado de grupo (p. ej. "Área social"). Si alguna columna lo trae, la hoja lleva dos
   * filas de encabezado: el grupo combinado sobre sus columnas consecutivas y, debajo, el título
   * de cada una. Una columna sin grupo ocupa las dos filas.
   */
  grupo?: string;
}

export type ValorCeldaHoja = string | number | null;

export interface HojaCalculo {
  nombreHoja: string;
  columnas: ColumnaHoja[];
  filas: ValorCeldaHoja[][];
}

/**
 * Genera un archivo de hoja de cálculo en memoria. Nunca escribe a disco: los reportes llevan
 * datos personales y no deben quedar copias en el servidor (plan §6).
 */
export interface IExportadorHojaCalculo {
  readonly tipoContenido: string;
  readonly extension: string;
  generar(hoja: HojaCalculo): Promise<Buffer>;
}
